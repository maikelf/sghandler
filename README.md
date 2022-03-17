# sghandler

## Install

`npm i sghandler`

## Use Example


```
import {dashboard} from 'sghandler';

const config = {
    host: 'localhost',
    port: '3000',
    user: 'admin',
    password: 'admin'
} 

const dash = new dashboard(config);
```

### Getting Datasources

```
async function getDatasources() {
    const values = await dash.getDatasources([]);
    console.log(values);
}

getDatasources();

```