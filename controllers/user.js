'use strict'

var bcrypt = require('bcrypt-nodejs');
var mongoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');
var User = require('../models/user');
var jwt = require('../services/jwt');

function home(req, res){
    res.status(200).send({
        message: "Hola mundo desde el servidor Nodejs"
    });
}

function pruebas(req, res){
    res.status(200).send({
        message: "Este mensaje es de prueba"
    });
}

//Función para guardar un nuevo usuario
function saveUser(req, res){
    //En la variable params recogemos los datos del body, es decir, del formulario
    var params = req.body;
    //Creamos un nuevo objeto User
    var user = new User();

    //Si el usuario llena todos los campos del formulario
    if(params.name && params.surname 
    && params.nick && params.email 
    && params.password)
    {
        //user toma los valores que se mandaron por el body
        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;

        //El objecto User buscara en el documento
        User.find({ $or: [

            //El email ingresado transformado en minusculas
            {email: user.email.toLowerCase()}, 
            //El nick ingresado transformado en minusculas
            {nick: user.nick.toLowerCase()}

        //Ejecutara una función de Callback (Un error o un usuario repetido)
        ]}).exec((err, users) => {

            //Si hay un error de petición con el servidor
            if(err) return res.status(500).send({
                message: "Hubo un error en la petición del servidor."
            });

            //Si el usuario ingresado ya existe en mas de un documento
            if(users && users.length >= 1)
            {
                return res.status(200).send({
                    message: "El usuario que intentas registrar ya existe"
                });
            }

            //Si no hay error o usuario repetido
            else
            {
                //Encriptara la contraseña con el método de bcrypt
                bcrypt.hash(params.password, null, null, (err, hash) => {
                user.password = hash;
                    
                    //Usamos el método de guarda con una función de Callback
                    user.save((err, userStored) => {

                        //Si existe un error al guardar un usuario
                        if(err) return res.status(500).send({
                            message: "Hubo un error en la petición del servidor"
                        });
                    
                        //Si el usuario ha sido registrado exitosamente
                        if(userStored)
                        {
                            res.status(200).send({user: userStored});
                        }
                    
                        //Si el usuario no se ha podido guardar
                        else
                        {
                            res.status(404).send({
                                message: "Error al registrar este usuario."
                            });
                        }
                    });
                });
            }
        });

    }

    //Si el usuario deja campos vacios en el formulario
    else
    {
        res.status(200).send({
            message: "No puedes dejar campos vacios"
        });
    }
}

//Función para logear usuarios
function loginUser(req, res)
{
    //En la variable params recogemos los datos del body
    var params = req.body;

    //Guardamos en las variables los datos ingresados
    var email = params.email;
    var password = params.password;

    //El objeto user buscara en el documento el email con una función de Callback
    User.findOne({email: email}, (err, user) => {
        
        //Si existe un error en el servidor
        if(err) return res.status(500).send({
            message: "Hubo un error en la petición del servidor."
        });

        //Si existe el email ingresado
        if(user)
        {
            //Decifra la contraseña con una función de Callback
            bcrypt.compare(password, user.password, (err, check) => {
                //Si existe un error en el servidor
                if(err) return res.status(500).send({
                    message: "Hubo un error en la petición del servidor"
                })

                //Si la contraseña ingresada es correcta
                if(check)
                {
                    //Si los parametros del token son autenticos
                    if(params.gettoken)
                    {
                        //Genera y devuelve el token
                        return res.status(200).send({
                            token: jwt.createToken(user)
                        });
                    }

                    //Si no lo son
                    else
                    {
                        //Devolver datos de usuario
                        user.password = undefined;
                        return res.status(200).send({user});
                    }

                }

                //Si el usuario ingresa una contraseña erronea
                else
                {
                    return res.status(404).send({
                        message: "El email y/o la password son incorrectas"
                    });
                }
            });
        }

        //Si el usuario digita un correo erroneo
        else
        {
            return res.status(404).send({
                message: "Llena todos los campos para poder inciar sesión."
            });
        }
    });
}

//Función que consigue datos de un usuario
function getUser(req, res)
{
    //En la variable userId recogemos el id como parametro
    var userId = req.params.id;

    //El objeto buscara el Id ingresado en el documento con una función del Callback
    User.findById(userId, (err, user) => {
        
        //Si existe un error en el servidor
        if(err) return res.status(500).send({
            message: "Hubo un error en la petición del servidor."
        });

        //Si el usuario no esta registrado
        if(!user) return res.status(404).send({
            message: "El usuario no existe en la base de datos"
        });

        //Si no, devolvera los datos del usuario con el Id solicitado
        return res.status(200).send({user});
    });
}

//Función para devolver un listado de usuarios paginados
function getUsers(req, res)
{
    var identity_user_id = req.user.sub;

    var page = 1;
    if(req.params.page)
    {
        page = req.params.page;
    }

    var itemsPerPage = 5;

    User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total) => {

        if(err) return res.status(500).send({
            message: "Hubo un error en la petición del servidor"
        });

        if(!users) return res.status(404).send({
            message: "No hay usuarios disponibles"
        });

        return res.status(200).send({
            users,
            total,
            pages: Math.ceil(total/itemsPerPage)
        });
    });
}

//Función para actualizar datos de un usuario
function updateUser(req, res)
{
    //En la variable userId recogemos el id ingresado por parametro
    var userId = req.params.id;
    //En la variable update recogemos los datos del body
    var update = req.body;

    //Borrar propiedad Password
    delete update.password;

    //Si el Id del usuario es diferente al id del usuario identificado
    if(userId != req.user.sub)
    {
        return res.status(500).send({
            message: "No tienes los permisos necesarios para actualizar este usuario."
        });
    }

    //Buscara en la colección algun documento repetido
    User.find({ $or: [

        //Busca el email
        {email: update.email},
        //Busca el nick
        {nick: update.nick}
    
    //Ejecuta una función de Callback
    ]}).exec((err,repeatUser) => {

        //Si existe un error en el servidor
        if(err) return res.status(500).send({
            message: "Error en la petición del servidor"
        });

        //Si el usuario intenta actualizar datos ya existentes
        if(repeatUser && repeatUser.length >= 1)
        {
            return res.status(404).send({
                message: "No puedes actualizar al usuario con estos elementos."
            });
        }

        //Si no existen errores
        else
        {
            //Buscara y actualizara en el documento con una función de Callback
            User.findByIdAndUpdate(userId, update, {new: true}, (err, userUpdated) => {

                //Si existe un error en la petición
                if(err) return res.status(500).send({
                    message: "Hubo un error en la petición del servidor."
                });

                //Si hay un error al actualizar los datos
                if(!userUpdated) return res.status(404).send({
                    message: "No se han podido actualizar los datos del usuario"
                });

                //Si todo es correcto, actualizara los datos
                return res.status(201).send({
                    message: {user: userUpdated}
                });
            });
        }

    });

}

//Función para subir archivos de imagen
function uploadImage(req, res)
{
    var userId = req.params.id;

    if(req.files)
    {
        var file_path = req.files.image.path;
        console.log(file_path);

        var file_split = file_path.split('\\');
        console.log(file_split);

        var file_name = file_split[2];
        console.log(file_name);

        var ext_split = file_name.split('\.');
        console.log(ext_split);

        var file_ext = ext_split[1];
        console.log(file_ext);

        if(userId != req.user.sub)
        {
            removeFilesOfUploads(res, file_path, 'No tienes los permisos para subir imágenes');
        }

        if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif')
        {
            //Actualizar documentado de usuario logueado
        }
    
        else
        {
            removeFilesOfUploads(res, file_path, 'Extensión de archivo no valida');
        }
    }

    else
    {
        return res.status(200).send({
            message: "No se han cargado imágenes"
        });
    }
}

function removeFilesOfUploads(res, file_path, message)
{
    fs.unlink(file_path, (err) => {

        return res.status(200).send({
        message: message
        });

    });
}

module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    updateUser,
    uploadImage
}
