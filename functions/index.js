const functions = require('firebase-functions');
const firebase = require('firebase');
const cors = require('cors');

const { getAllJazz, postSingleJazz, getJazz, commentOnJazz, likeJazz, unlikeJazz, deleteJazz } = require('./handlers/jazz');
const { signup, login, uploadImage, addUserDetails, getAuthenticatedUser } = require('./handlers/users');
const FBAuth = require('./handlers/helpers/authHelpers');
const { db } = require('./config/admin');

const app = require('express')();

app.use(cors({ origin: true }));

// Jazz routes
app.get('/jazz', getAllJazz);
app.post('/jazz', FBAuth, postSingleJazz);
app.get('/jazz/:jazzId', getJazz);
app.post('/jazz/:jazzId/comment', FBAuth, commentOnJazz);
app.get('/jazz/:jazzId/like', FBAuth, likeJazz);
app.get('/jazz/:jazzId/unlike', FBAuth, unlikeJazz);
app.delete('/jazz/:jazzId', FBAuth, deleteJazz);


// User routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);

exports.api = functions.region('europe-west1').https.onRequest(app);

exports.createNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
  .onCreate(snapshot => {
    return db.doc(`/jazz/${snapshot.data().jazzId}`).get()
      .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            jazzId: doc.id
          });
        }
      })
      .catch(err => {
        console.error(err);
      })
})

exports.deleteNotificationOnUnlike = functions.region('europe-west1').firestore.document('likes/{id}')
  .onDelete(snapshot => {
    return db.doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.log(err);
        return;
      })
  })

exports.createNotificationOnComment = functions.region('europe-west1').firestore.document('comment/{id}')
  .onCreate(snapshot => {
    return db.doc(`/jazz/${snapshot.data().jazzId}`).get()
      .then(doc => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            jazzId: doc.id
          });
        }
      })
      .catch(err => {
        console.error(err);
        return;
      })
  })

exports.onUserImageChange = functions.region('europe-west1').firestore.document('/users/{userId}')
  .onUpdate(change => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('Image has changed');
      const batch = db.batch(); //change multiple fields
      return db.collection('jazz').where("userHandle", "==", change.before.data().handle).get()
        .then(data => {
          data.forEach(doc => {
            const jazz = db.doc(`/jazz/${doc.id}`);
            batch.update(jazz, { userImage: change.after.data().imageUrl });
          })
          return batch.commit();
        })
    }

  })

exports.onJazzDelete = functions.region('europe-west1').firestore.document('/jazz/{jazzId}')
  .onDelete((snapshot, context) => { //context has the parameters from the url
    const jazzId = context.params.jazzId;
    const batch = db.batch();
    return db.collection('comments').where('jazzId', '==', jazzId).get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        })
        return db.collection('likes').where('jazzId', '==', jazzId).get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        })
        return db.collection('notifications').where('jazzId', '==', jazzId).get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        })
        return batch.commit();
      })
      .catch(err => {
        console.error(err);
      })
  })
