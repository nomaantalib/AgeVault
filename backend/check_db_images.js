require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await mongoose.connection.db.collection('users')
    .find({})
    .project({ name: 1, email: 1, phone: 1, role: 1, status: 1, idCardUrl: 1, selfieUrl: 1 })
    .toArray();
  
  users.forEach(u => {
    console.log(u.name, '|', u.email, '|', u.phone, '|', u.role, '|', u.status, '| ID:', u.idCardUrl, '| Selfie:', u.selfieUrl);
  });
  console.log('Total users:', users.length);
  await mongoose.disconnect();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
