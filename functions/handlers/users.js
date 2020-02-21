const { admin, db } = require('../config/admin');
const firebase = require('firebase');
const Busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const cors = require('cors')({ origin: true });

// password is 1234five;

const appConfig = require('../config/appConfig');
const { validateSignupData, validateLoginData, reduceUserDetails } = require('./helpers/validators');

firebase.initializeApp(appConfig);

exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };

  const{ errors, valid } = validateSignupData(newUser);

  if(!valid) return res.status(400).json(errors);

  const no_image = 'man.jpg'

  // check if userhandle is already taken
  let token, userId;
  db.doc(`/users/${newUser.handle}`).get()
    .then(doc => {
      if(doc.exists) {
        return res.status(400).json({handle: 'this handle is already taken'});
      } else {
        return firebase
          .auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${appConfig.storageBucket}/o/users%2F${no_image}?alt=media`,
        userId
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.log(err);
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ email: 'Email is already in use' })
      } else {
        return res.status(500).json({ general: "Something went wrong, please try again" });
      }
    })
}

exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  }

  const{ errors, valid } = validateLoginData(user);

  if(!valid) return res.status(400).json(errors);

  firebase.auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.status(200).json({ token })
    })
    .catch(err => {
      console.error(err);
      // auth/wrong-password
      // auth/user-not-found
      // if(err.code === 'auth/wrong-password'){
        return res.status(403).json({ general: 'Wrong credentials, please try again'})
      // } else {
        // return res.status(500).json({ error: err.code });
      }
    )
}

// Add user details
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(() => {
      return res.json({ message: "Details added successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: err.code });
    })
}

// Get own user details
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
      if(doc.exists) {
        userData.credentials = doc.data();
        return db.collection('likes').where('userHandle', '==', req.user.handle).get()
      }
    })
    .then(data => {
      userData.likes = []
      data.forEach(doc => {
        userData.likes.push(doc.data());
      })
      return res.json(userData);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err.code });
    })
}

// upload profile image for users
exports.uploadImage = (req, res) => {

  const busboy = new Busboy({ headers: req.headers });

  let imageFileName;
  let imageToBeUploaded;

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    console.log(fieldname);
    console.log(filename);
    console.log(mimetype);

    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(Math.random() * 10000000000)}.${imageExtension}`;

    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = {filepath, mimetype};
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on('finish', () => {
    admin.storage().bucket().upload(imageToBeUploaded.filepath, {
      resumable: false,
      destination: `users/${imageFileName}`,
      metadata: {
        metadata: {
          contentType: imageToBeUploaded.mimetype
        }
      }
    })
    .then(() => {
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${appConfig.storageBucket}/o/users%2F${imageFileName}?alt=media` //alt+media shows the image in the browser insead of downloadig in it in our PC
      return db.doc(`/users/${req.user.handle}`).update({ imageUrl })//destructuring here
    })
    .then(() => {
      return res.json({ message: 'Image uploaded successfully' });
    })
    .catch(err => {
      return res.status(500).json({ error: err.code });
    });
  })
  if (req.rawBody) {
    busboy.end(req.rawBody);
  } else {
    req.pipe(busboy);
  }
  // res.status(200).json({message: "It works"})
}
