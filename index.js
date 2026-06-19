const express = require('express');
const dotenv = require('dotenv');

const app = express();
const cors = require('cors');
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
    // console.log('logger logged', req.params);
    next();
}

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const db = client.db(process.env.AUTH_DB_NAME);
        const jobCollection = db.collection('jobs');
        const companyCollection = db.collection("companies");
        const usersCollection = db.collection("user");
        const applicationsCollection = db.collection("applications");
        const planCollection = db.collection("plans");
        const subscriptionCollection = db.collection("subscription");
        const sessionCollection = db.collection("session");
        // verification related 

        const verifyToken = async (req, res, next) => {
            const authHeader = req.headers?.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const token = authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const query = { token: token }
            const session = await sessionCollection.findOne(query);

            if (!session) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            const userId = session.userId;
            const userQuery = {
                _id: userId
            }
            const user = await usersCollection.findOne(userQuery);

            if (!user) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            // set data in the req object
            req.user = user;
            next();
        }

        // must be used after verify token middleware
        const verifySeeker = async (req, res, next) => {
            if (req.user?.role == 'seeker') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyRecruiter = async (req, res, next) => {
            if (req.user?.role == 'recruiter') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifyAdmin = async (req, res, next) => {
            if (req.user?.role == 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        /-------------/

        // jobs related api
        app.get('/api/jobs', async (req, res) => {
            const query = {};
            // job filter related query
            if (req.query.search) {
                query.$or = [
                    { jobTitle: { $regex: req.query.search, $options: 'i' } },
                    { companyName: { $regex: req.query.search, $options: 'i' } }
                ]
            }

            if (req.query.jobType) {
                query.jobType = req.query.jobType
            }

            if (req.query.jobCategory) {
                query.jobCategory = req.query.jobCategory
            }

            if (req.query.isRemote) {
                query.isRemote = req.query.isRemote
            }

            // company related query
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            if (req.query.status) {
                query.status = req.query.status;
            }

            // pagination related
            if (req.query.page) {
                const page = req.query.page;
                const perPage = req.query.perPage || 12;
                const skipItems = (page - 1) * perPage;

                const cursor = jobCollection.find(query).skip(skipItems).limit(perPage);
                const jobs = await cursor.toArray();
                return res.send(jobs);
            }

            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/api/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobCollection.findOne(query);
            res.send(result);
        })

        app.post('/api/jobs', async (req, res) => {
            const job = req.body;
            const newJob = {
                ...job,
                createAt: new Date()
            }
            const result = await jobCollection.insertOne(newJob);
            res.send(result);
        })

        // application related api
        app.get('/api/application', verifyToken, verifySeeker, async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;

                // check whether asking for user information or someone else

                if (req.user._id.toString() !== req.query.applicantId) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }
            const cursor = applicationsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/api/application', async (req, res) => {
            const application = req.body;
            const newApplication = {
                ...application,
                createAt: new Date()
            }
            const result = await applicationsCollection.insertOne(newApplication);
            res.send(result);
        })

        // company related apis
        // app.get('/api/companies', async (req, res) => {
        //     const cursor = companyCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

        // inefficient way to join collection
        app.get('/api/companies', verifyToken, async (req, res) => {
            const cursor = companyCollection.find();
            const companies = await cursor.toArray();
            for (const company of companies) {
                const filter = {
                    companyId: company._id.toString()
                }
                const jobCount = await jobCollection.countDocuments(filter)
                company.jobCount = jobCount
            }
            res.send(companies);
        })

        // inefficient way to join collection
        // app.get('/api/companies2', async (req, res) => {
        //     const pipeline = [
        //         {
        //             $skip: 5
        //         }
        //     ]
        //     const cursor = companyCollection.aggregate(pipeline);
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

        app.get('/api/my/companies', async (req, res) => {
            const query = {};
            if (req.query.recruiterId) {
                query.recruiterId = req.query.recruiterId;
            }
            const result = await companyCollection.findOne(query);
            res.send(result || {});
        })

        app.post('/api/companies', async (req, res) => {
            const company = req.body;
            const newCompany = {
                ...company,
                createAt: new Date()
            }
            const result = await companyCollection.insertOne(newCompany);
            res.send(result);
        })

        app.patch('/api/companies/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedCompany = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: updatedCompany.status
                }
            }
            const result = await companyCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // plans
        app.get('/api/plans', async (req, res) => {
            const query = {}
            if (req.query.plan_id) {
                query.id = req.query.plan_id
            }
            const plan = await planCollection.findOne(query);
            res.send(plan);
        })

        // subscription
        app.post('/api/subscriptions', async (req, res) => {
            const data = req.body;
            const subsInfo = {
                ...data,
                createdAt: new Date()
            }
            const result = await subscriptionCollection.insertOne(subsInfo);

            // update the user plan information
            const filter = { email: data.email };
            // update the value
            const updateDocument = {
                $set: {
                    plan: data.planId,
                }
            };
            const updateResult = await usersCollection.updateOne(filter, updateDocument);
            res.send(updateResult);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is Serving...')
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})