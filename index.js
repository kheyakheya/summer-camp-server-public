const express= require ('express');
const app= express();
const cors = require('cors');
const jwt= require('jsonwebtoken');
const port= process.env.PORT || 5000;
require('dotenv').config();
const stripe= require('stripe')(process.env.PAYMENT_SECRET_KEY);

// middle ware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());
// jwt middle ware
const verifyJWT=(req,res,next)=>{
  const authorization= req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'})
  }
  const token= authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err,decoded)=>{
      if(err){
         return res.status(401).send({error: true, message: 'unauthorized access'})

      }
      req.decoded= decoded;
      next();
  })

}
// mongo code 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dvb9ofq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection= client.db('assignmentDb').collection('users');
    const classesCollection= client.db('assignmentDb').collection('classes');
    const cartCollection= client.db('assignmentDb').collection('cart');
    const paymentsCollection= client.db('assignmentDb').collection('payments');
    const enrolledCollection= client.db('assignmentDb').collection('enrolled');

    // server side code here
    // jwt post 
    app.post('/jwt', (req,res)=>{
      const user= req.body;
      const token= jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7D'});
      res.send({token})

    })
    // verify admin middleware
    const verifyAdmin=async (req,res,next)=>{
      const email= req.decoded.email;
      const query= {email: email};
      const user= await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: 'forbidden access'})

      }
      next();
     }
    // users related work
    //  get users from bd
    app.get('/users', verifyJWT, verifyAdmin, async(req,res)=>{
      const result= await usersCollection.find().toArray();
      res.send(result)
    } )
    // save user to db
    app.put('/users/:email', async(req,res)=>{
      const email= req.params.email;
      const user= req.body;
      const query={email: email};
      const options= {upsert: true};
      const updateDoc={
        $set: user,
      };
      const result= await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);

    })
    //  checking is admin with email
    app.get('/users/admin/:email', verifyJWT, async(req,res)=>{
      const email= req.params.email;
      if(req.decoded.email !== email){
        return res.status(403).send({error: true, message: 'false admin'})
      }
      const  query={email:email};
      const user= await usersCollection.findOne(query);
      const result= {admin: user?.role === 'admin'};
      res.send(result);
    })
    app.get('/users/instructor/:email', verifyJWT, async(req,res)=>{
      const email= req.params.email;
      if(req.decoded.email !== email){
        return res.status(403).send({error: true, message: 'Fake instructor'})
      }
      const  query={email:email};
      const user= await usersCollection.findOne(query);
      const result= {instructor: user?.role === 'instructor'};
      res.send(result);
    })
    //  update role of user
    app.patch('/users/admin/:id', async(req,res)=>{
      const id= req.params.id;
      const filter= {_id: new ObjectId(id)};
      const updateDoc= {
        $set:{
          role: 'admin',
        }
      }
      const result= await usersCollection.updateOne(filter,updateDoc);
      res.send(result);
    })
    app.patch('/users/instructor/:id', async(req,res)=>{
      const id= req.params.id;
      const filter= {_id: new ObjectId(id)};
      const updateDoc= {
        $set:{
          role: 'instructor',
        }
      }
      const result= await usersCollection.updateOne(filter,updateDoc);
      res.send(result);
    })
    // post classes
    app.post('/classes', verifyJWT, async(req,res)=>{
      const query= req.body;
      const result= await classesCollection.insertOne(query);
      res.send(result);
      })
    app.get('/classes',  async(req,res)=>{
      const result= await classesCollection.find().toArray();
      res.send(result);
      })
      // update class status to approve by admin
      app.patch('/classes/approved/:id', async(req,res)=>{
        const id= req.params.id;
        
        const filter= {_id: new ObjectId(id)};
        const updateDoc= {
          $set:{
            status: 'approved',
          }
        }
        const result= await classesCollection.updateOne(filter,updateDoc);
        console.log(result);
        res.send(result);
      })
      // update class status to deny by admin
      app.patch('/classes/denied/:id', async(req,res)=>{
        const id= req.params.id;
        
        const filter= {_id: new ObjectId(id)};
        const updateDoc= {
          $set:{
            status: 'denied',
          }
        }
        const result= await classesCollection.updateOne(filter,updateDoc);
        console.log(result);
        res.send(result);
      })
      // update feedback by admin
      app.patch('/classes/feedback/:id', async(req,res)=>{
        const id= req.params.id;
        const {feedback}= req.body;
        
        const filter= {_id: new ObjectId(id)};
        const updateDoc= {
          $set:{
            feedback: feedback,
          }
        }
        const result= await classesCollection.updateOne(filter,updateDoc);
        console.log(result);
        res.send(result);
      })
      // getting instructor email wise class
      app.get('/classes/:email',async(req,res)=>{
        const email= req.params.email;
        const query= {email:email};
        const result= await classesCollection.find(query).toArray();
        res.send(result);
      })
      // update class by instructor
      app.put('/classes/:id', verifyJWT, async(req,res)=>{
        const id=req.params.id;
        const updatedItem= req.body;
        const filter= {_id: new ObjectId(id)};
        const updateDoc={
          $set:{
            name: updatedItem.name,
            price: updatedItem.price,
           
  
          }
        }
        console.log(updateDoc);
        const result= await classesCollection.updateOne(filter,updateDoc);
        res.send(result);
  
      })
      // getting top six classes
      app.get('/top-class', async(req,res)=>{
        const topClasses = await classesCollection.find().sort({ enrolled: -1 }).limit(6).toArray();
        res.send(topClasses);        

      })
      
      // getting approved classes
      app.get('/class/approved', async(req,res)=>{
      const result= await classesCollection.find({status:'approved'}).toArray();
      res.send(result);
    })
    
    // getting instructors
    app.get('/users/instructors', async(req,res)=>{
      const result= await usersCollection.find({role:'instructor'}).toArray();
      res.send(result);
    })
    // getting six instructors
    app.get('/users/instructors/top', async(req,res)=>{
      const result= await usersCollection.find({role:'instructor'}).limit(6).toArray();
      res.send(result);
    })

    // posing classes in cart
    app.post('/cart',async(req,res)=>{
      const chosen= req.body;
      const result= await cartCollection.insertOne(chosen);
      res.send(result);
    })
    // getting cart
    app.get('/cart',verifyJWT,async(req,res)=>{
      const email=req.query.email;
      if(!email){
        res.send([])
      }
      const decodedEmail= req.decoded.email;
      if(email !== decodedEmail){
       return res.status(403).send({error: true, message: 'forbidden access'})
      }
      const query={email:email};
      const result= await cartCollection.find(query).toArray();
      res.send(result);
      })
    // deleting class from cart
    app.delete('/cart/:id', async(req,res)=>{
      const id= req.params.id;
      const query={_id: new ObjectId(id)}
      const result= await cartCollection.deleteOne(query);
      res.send(result);

    })
    // payment intent
    app.post('/create-payment-intent',verifyJWT,async(req,res)=>{
      const {price}=req.body;
      const amount= parseInt(price*100);
      
      const paymentIntent= await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({clientSecret: paymentIntent.client_secret})
  })
    app.post('/payments',verifyJWT,async(req,res)=>{
      payment=req.body;
      const insertResult= await paymentsCollection.insertOne(payment);
      const query={_id: new ObjectId(payment.cartId)};
      const deleteResult= await cartCollection.deleteOne(query);
      // update
      const increasedEnroll= payment.enrolled + 1;
      const decreasedSeat= payment.seats - 1;
      console.log(increasedEnroll,decreasedSeat )
      const filter= {_id: new ObjectId(payment.classId)};
        const updateDoc= {
          $set:{
            enrolled: increasedEnroll,
            seats: decreasedSeat,
            }
        }
        const updateResult= await classesCollection.updateOne(filter,updateDoc);
        // update end
      res.send({insertResult,deleteResult, updateResult})
    })
    // post enrolled classes
    app.post('/enrolled', async (req,res)=>{
      const enrolledLesson= req.body;
      console.log(enrolledLesson);
      const result= await enrolledCollection.insertOne(enrolledLesson);
      res.send(result);
      })
      // get enrolled by email
      app.get('/enrolled/:email',async(req,res)=>{
        const email=req.params.email;
        const query={email:email};
        const result= await enrolledCollection.find(query).toArray();
        res.send(result);
        })
      // get payment history by email
      app.get('/payments/:email',async(req,res)=>{
        const email=req.params.email;
        const query={email:email};
        const result= await paymentsCollection.find(query).sort({date: -1}).toArray();
        res.send(result);
        })

  
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req,res)=>{
    res.send("twelve running");
})
app.listen(port,()=>{
    console.log(`twelve running port ${port}`)
})
