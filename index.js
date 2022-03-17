import axios from "axios";
import {templates} from "./templates/templates";
export class dashboard {
    
    constructor(config) {
        this.url = config.proxy ? `http://${config.host}/${config.proxy}/api` :  `http://${config.host}:${config.port}/api`;
        this.config = {
            auth: {
              username: config.user,
              password: config.password
            }
        };
        this.blackList = ['2D', '3D', '2D,3D'];
    }

    buildDatasetBoardFromTemplate(
        template,
        tags,
        dataset,
        folder,
        type,
        previus,
        gdatasources
    ) {
        let data = Object.assign({}, templates[template]);
        const datasources = {};

        data.datasource_replace.type.forEach((t, i) => {
            const DS = gdatasources.find(item => item['type'] === t && item['name'] === data.datasource_replace.datasource_name[i]);
            datasources[t] = DS ? DS['uid'] : null;
        })


        // -- INTERPOLATION --

        // -- GENERAL DATA --
        data.tags = tags || [];
        data.title = `${dataset.id} ${type}`;
        data.id = previus.id || null;
        data.version = previus.version || 0;
        data.iteration = new Date().getTime();

        // -- PANELS --
        const panels =  data.panels;

        panels.forEach(p => {
            if (p.datasource) { 
                const uid = datasources[p.datasource.type];
                if (uid) {
                    p.datasource.uid = uid;
                }
            }

            if (p.targets) {
                p.targets.forEach(pt => {
                    if (pt.datasource) {
                        const tuid = datasources[pt.datasource.type];
                        if (tuid) {
                            pt.datasource.uid = tuid;
                        }
                    }
                })
            }
        })

        data.panels = panels;

        // -- TEMPLATING --
        const templatingList = data.templating.list;

        templatingList.forEach(tl => {
            if (tl.name === "dataset_id" && this.blackList.indexOf(tl.query) === -1) {
                tl.query = `"${dataset.id}"`;
            }

            if (tl.datasource) {
                const uid = datasources[tl.datasource.type];
                tl.datasource.uid = uid;
            }
        });

        data.templating.list = templatingList;

        // -- TIME --
        if (data.time) {
            data.time.from = new Date(dataset.start).toISOString();
            data.time.to = new Date(dataset.end).toISOString();
        }

        // -- REMOVE UNNECESSARY --
        delete data.datasource_replace;

        // -- RETURN --
        return {dashboard: data, folderId: folder.folderId || 0, overwrite: true};
    }

    getFolders(folderName) {
        return axios.get(`${this.url}/folders`, this.config)
        .then(
            folders => {
                if(!folders.data) {
                    return Promise.resolve(null);
                } else {
                    return Promise.resolve(folders.data.find(e => e.title === folderName))
                }
            },
            error => null
        );
    }

    createFolder(folderName) {   
        return axios.post(`${this.url}/folders`, { title: folderName }, this.config)
        .then(
            newFolder => newFolder.data,
            error => null
        );
    }

    createDashboard(config, payload) {
        return axios.post(`${this.url}/dashboards/db`, payload, this.config)
        .then(
            newBoard => newBoard.data,
            error => {
                console.log(error)
                return null;
            }
        );
    }

    getDatasources(datasourceNames) {
        return axios.get(`${this.url}/datasources`, this.config)
        .then(
            datasources => {
                if(!datasources.data) {
                    return Promise.resolve(null);
                } else if (!datasourceNames || !datasourceNames.length) {
                    return Promise.resolve(datasources.data) 
                } else {
                    return Promise.resolve(datasources.data.filter(e => datasourceNames.find(f => f === e.name)));
                }
            },
            error => null
        )
    }

    getDatasourceByName(name) {
        return axios.get(`${this.url}/datasources/name/${name}`, this.config)
        .then(
            datasource => {
                if(!datasource.data || datasource.status === 404) {
                    return Promise.resolve(null);
                } else {
                    return Promise.resolve(datasource.data);
                }
            },
            error => null
        )
    }

    createDataSource(payload) {
        return axios.post(`${this.url}/datasources`, payload, this.config)
        .then(
            newDatasource => newDatasource.data,
            error => null
        );
    }

    async createDatasetBoards(dataset, visualizationInfo) {
        let datasetPreviusDashboard = [];
        
        if (dataset.dashboards) {
            try {
                datasetPreviusDashboard = JSON.parse(dataset.dashboards);
            } catch (err) {
                console.log(err);
            }
        }
       
        if (visualizationInfo.length) {
            const folderName = `DATASET:${dataset.id}`;
            let ML_TRAINER_FOLDER = await this.getFolders(folderName);
            let ML_DATASOURCES = await this.getDatasources(null); 

            if (!ML_TRAINER_FOLDER) {
                ML_TRAINER_FOLDER = await this.createFolder(folderName);
            }

            const op = visualizationInfo.map(async (e) => { 
                let previusData = {id: null, version: null};

                if (Array.isArray(datasetPreviusDashboard)) {
                    const pd = datasetPreviusDashboard.find(d => d.template_name === e.template_name);
                    if (pd) {
                        previusData = { id: pd.id, version: pd.version };
                    }
                }

                const payload = this.buildDatasetBoardFromTemplate(
                    e.template_name,
                    ['ML Trainer', 'Dataset', e.label],
                    dataset,
                    { folderId: ML_TRAINER_FOLDER.id, folderUid: ML_TRAINER_FOLDER.uid },
                    e.label,
                    previusData,
                    ML_DATASOURCES
                );

                const newDashboard = await this.createDashboard(payload);

                let element = e;
                if (newDashboard) {
                    element.url = `/${newDashboard.url}?kiosk`;
                    element.id = `${newDashboard.id}`;
                    element.version = `${newDashboard.version}`;
                }

                return Promise.resolve(element);
            });

            return Promise.all(op);
        }

        return Promise.resolve(visualizationInfo)
    }
}
