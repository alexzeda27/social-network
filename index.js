'use strict'

var mongoose = require('mongoose');
var app = require('./app');
var port = 3800;

//Conexión a la base de datos
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/social-network', { useUnifiedTopology: true, useNewUrlParser: true })
        .then(() => {
            console.log("La conexión a la base de datos, se ha realizado correctamente");

            //Creación del servidor
            app.listen(port, () => {
                console.log("Servidor creado correctamente");
            });
        })
        .catch(err => console.log(err));
