const http = require('http');
const fs = require('fs');
var contentType = require('content-type');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var formidable = require('formidable');


var express = require('express');
const app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extend: true, limit: '50mb'}));
app.use(bodyParser.json({ limit: '50mb',}));

//mock db 
let requisitions = []
 

// app.post('/submit-requisition', (req, res = {
//     const newRequest = {
//         id: Date.now(),
//         data: req.body,
//         status: 'PENDING_HOD',
//         history: [{ stage: 'Prepared', date: new Date()}]
//     }
// }))


//Addition
app.post('/submit-requisition', (req, res) => {
    const form = new formidable.IncomingForm();
    
    form.parse(req, (err, fields, files) => {
        if (err) return res.status(500).send("Error processing form.");

        // Create the requisition object
        const newRequisition = {
            id: Date.now(),
            date: fields.requestDate,
            department: fields.department,
            items: [], // We would loop through fields.budgetLine here
            attachment: files.attachment ? files.attachment[0].originalFilename : null,
            status: 'PENDING_HOD'
        };

        requisitions.push(newRequisition);
        console.log("Submission received from Staff side.");
        res.send("<h1>Success!</h1><p>Your requisition has been sent to your HOD for approval.</p><a href='/'>Back to Form</a>");
    });
});




//approval logic
// This is how your MongoDB Schema will look later
/*
const RequisitionSchema = new mongoose.Schema({
    staffName: String,
    department: String,
    items: [{ description: String, qty: Number, unit: Number, total: Number }],
    status: { type: String, default: 'PENDING_HOD' },
    attachmentPath: String,
    hodSignature: String, // Base64
    financeSignature: String,
    history: Array
});
*/

app.post('/hod/submit-approval/:id', (req, res) => {
    const { id } = req.params;
    const { signature, action } = req.body;

    // In-memory logic for now (swapping to MongoDB later)
    let request = requisitions.find(r => r.id == id);
    
    if (request) {
        if (action === 'approve') {
            request.status = 'PENDING_FINANCE';
            request.hodSignature = signature;
            request.history.push({ stage: 'HOD_APPROVED', time: new Date() });
        } else {
            request.status = 'REJECTED';
            request.history.push({ stage: 'REJECTED_BY_HOD', time: new Date() });
        }
        res.redirect('/hod/dashboard');
    }
});



//finance approval status 
app.post('/finance/submit-approval/:id', (req, res) => {
    const request = requisitions.find(r => r.id == req.params.id);
    if (request) {
        request.status = 'PENDING_DIRECTOR';
        request.financeSignature = req.body.signature; // From the hidden input
        request.history.push({ stage: 'FINANCE_AUTHORIZED', date: new Date() });
        res.redirect('/finance/dashboard');
    }
});




//routes for finance approvals
// Route to view all pending approvals for Finance
app.get('/finance/dashboard', (req, res) => {
    // Later, this will be: const pending = await Requisition.find({ status: 'PENDING_FINANCE' });
    const pendingRequests = requisitions.filter(r => r.status === 'PENDING_FINANCE');
    res.render('finance_dashboard', { requests: pendingRequests });
});






// Route for the Director to see final pending requests
app.get('/director/dashboard', (req, res) => {
    // Logic: Filter for 'PENDING_DIRECTOR' status
    const pendingRequests = requisitions.filter(r => r.status === 'PENDING_DIRECTOR');
    res.render('director_dashboard', { requests: pendingRequests });
});

app.post('/director/submit-approval/:id', (req, res) => {
    const { id } = req.params;
    const { signature, action } = req.body;

    let request = requisitions.find(r => r.id == id);
    if (request) {
        if (action === 'approve') {
            request.status = 'APPROVED';
            request.directorSignature = signature;
            request.history.push({ stage: 'FINAL_APPROVAL', date: new Date() });
            console.log(`Requisition ${id} is now fully Approved.`);
        } else {
            request.status = 'REJECTED_BY_DIRECTOR';
            request.history.push({ stage: 'REJECTED', date: new Date() });
        }
        res.redirect('/director/dashboard');
    }
});










var url = require('url');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');


const { createServer } = require('node:http');

const hostname = '127.0.0.1';
const port = 3000;



// const server = http.createServer((req, res) => {
//     res.statusCode = 200;
//     res.setHeader('Content-Type', 'text/html');
//  // res.end('Hello World');
// });
const server = http.createServer(app);

app.get('/', (req,res) => {
    res.render('index');
});

app.set('view engine', 'ejs');

var myEventHandler = function () {
    console.log('Tuko on...');
}


//models for the db



const db = require('./config/db');

app.post('/submit-requisition', (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        try {
            // 1. Insert the main Requisition
            const [result] = await db.execute(
                'INSERT INTO requisitions (requestDate, department, staffName, attachmentPath) VALUES (?, ?, ?, ?)',
                [fields.requestDate, fields.department, 'Brian Wekesa', files.attachment[0].originalFilename]
            );
            
            const newId = result.insertId;

            // 2. Insert all items (assuming they come as arrays)
            const itemQueries = fields.description.map((desc, i) => {
                return db.execute(
                    'INSERT INTO requisition_items (requisition_id, description, qty, unitPrice, total) VALUES (?, ?, ?, ?, ?)',
                    [newId, desc, fields.qty[i], fields.unit[i], fields.total[i]]
                );
            });

            await Promise.all(itemQueries);
            res.send("Requisition saved to MySQL!");
        } catch (error) {
            console.error(error);
            res.status(500).send("Database error occurred.");
        }
    });
});









//Assign the event handler to an event:
eventEmitter.on('scream', myEventHandler);

//fire the 'scream' event:
eventEmitter.emit('scream');


server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
