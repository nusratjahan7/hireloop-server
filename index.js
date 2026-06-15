const express = require('express');
const dotenv = require('dotenv');

const app = express();
const cors = require('cors');
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());


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
        const applicationsCollection = db.collection("applications");

        app.get('/api/jobs', async (req, res) => {
            const query = {};
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            if (req.query.status) {
                query.status = req.query.status;
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
        app.get('/api/application', async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;
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