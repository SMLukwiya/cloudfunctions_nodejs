const { db } = require('../config/admin');
const cors = require('cors');

exports.getAllJazz = (req, res) => {
    db
    .collection('jazz')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data => {
      let jazz = [];
      data.forEach(doc => {
        jazz.push({
          jazzId: doc.id,
          ...doc.data()
        });
      });
      return res.json(jazz);
    }).catch(err => console.error(err));
}

exports.postSingleJazz = (req, res) => {
  // after verifyIdToken, we have access to req.user from the auth function
  const newJazz = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };

  db
    .collection('jazz')
    .add(newJazz)
    .then((doc => {
      const resJazz = newJazz;
      resJazz.jazzId = doc.id
      res.json({ resJazz});
    }))
    .catch(err => {
      res.status(500).json({ error: 'something went wrong'})
      console.error(err);
    })
}

exports.getJazz = (req, res) => {
  let jazzData = {};

  db.doc(`/jazz/${req.params.jazzId}`)
    .get()
    .then(doc => {
      if(!doc.exists) {
        return res.status(404).json({ error: `Jazz not found ${req.params.jazzId}` });
      }
      jazzData = doc.data();
      jazzData.jazzId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('jazzId', '==', req.params.jazzId)
        .get();
    })
    .then(data => {
      jazzData.comments = [];
      data.forEach(doc => {
        jazzData.comments.push(doc.data());
      });
      return res.json(jazzData);
    })
    .catch(err => {
      console.error(err)
      res.status(500).json({ error: err.code });
    })
}

// Comment on a jazz
exports.commentOnJazz = (req, res) => {
  if(req.body.body.trim() === '') return res.status(400).json({ comment: 'Must not be empty'});

  const newComment = {
    body: req.body.body,
    createAt: new Date().toISOString(),
    jazzId: req.params.jazzId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };

  db.doc(`/jazz/${req.params.jazzId}`).get()
    .then(doc => {
      if(!doc.exists) {
        res.status(404).json({ error: 'Jazz not found'});
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection('comments').add(newComment);
    })
    .then(() => {
      return res.json(newComment)
    })
    .catch(err => {
      console.log(err);;
      res.status(500).json({ error: "Something went wrong" });
    })
  }

// like a jazz
exports.likeJazz = (req, res) => {
  const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('jazzId', '==', req.params.jazzId).limit(1)

  const jazzDocument = db.doc(`/jazz/${req.params.jazzId}`);

  let jazzData;

  jazzDocument.get()
    .then(doc => {
      if(doc.exists) {
        jazzData = doc.data();
        jazzData.id = doc.id;
        return likeDocument.get()
      } else {
        return res.status(404).json({ error: 'Jazz not found' });
      }
    })
    .then(data => {
      if(data.empty) {
        return db.collection('likes').add({
          jazzId: req.params.jazzId,
          userHandle: req.user.handle
        })
        .then(() => {
          jazzData.likeCount++
          return jazzDocument .update({ likeCount: jazzData.likeCount })
        })
        .then(() => {
          return res.json(jazzData);
        })
      } else {
        return res.status(400).json({ error: "Jazz already likes" });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err.code });
    })
}

exports.unlikeJazz = (req, res) => {
  const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('jazzId', '==', req.params.jazzId).limit(1)

  const jazzDocument = db.doc(`/jazz/${req.params.jazzId}`);

  let jazzData;

  jazzDocument.get()
    .then(doc => {
      if(doc.exists) {
        jazzData = doc.data();
        jazzData.id = doc.id;
        return likeDocument.get()
      } else {
        return res.status(404).json({ error: 'Jazz not found' });
      }
    })
    .then(data => {
      if(data.empty) {
        return res.status(400).json({ error: "Jazz not yet liked" });
      } else {
          return db.doc(`/likes/${data.docs[0].id}`).delete()
            .then(() => {
              jazzData.likeCount--;
              return jazzDocument.update({ likeCount: jazzData.likeCount})
            })
            .then(() => {
              return res.json(jazzData);
            })
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err.code });
    })
}

exports.deleteJazz = (req, res) => {
  const document = db.doc(`/jazz/${req.params.jazzId}`);
  document.get()
    .then(doc => {
      if(!doc.exists) {
        return res.status(400).json({ error: "Jazz not found" });
      }
      if(doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Authorised" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Deleted jazz successfully" });
    })
    .catch(err => {
      return res.status(500).json({ error: err.code });
    })
}
