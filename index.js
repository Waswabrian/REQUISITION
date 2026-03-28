    const http = require('http');
    const fs = require('fs');
    var contentType = require('content-type');
    var events = require('events');
    var eventEmitter = new events.EventEmitter();
    var formidable = require('formidable');


    var express = require('express');
    const app = express();
    app.set('view engine', 'ejs');

    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true, limit: '50mb'}));
    app.use(express.json({ limit: '50mb'}));

    // In-memory data store for demo purposes
    let requisitions = []


    // app.post('/submit-requisition', (req, res = {
    //     const newRequest = {
    //         id: Date.now(),
    //         data: req.body,
    //         status: 'PENDING_HOD',
    //         history: [{ stage: 'Prepared', date: new Date()}]
    //     }
    // }))


    // Addition: Store new requisition from the form
    app.post('/submit-requisition', (req, res) => {
        const form = new formidable.IncomingForm({ multiples: true });

        form.parse(req, (err, fields, files) => {
            if (err) return res.status(500).send("Error processing form.");

            // Ensure fields that may be single values become arrays for stable loop
            const budgetLine = Array.isArray(fields.budgetLine) ? fields.budgetLine : [fields.budgetLine].filter(Boolean);
            const description = Array.isArray(fields.description) ? fields.description : [fields.description].filter(Boolean);
            const qty = Array.isArray(fields.qty) ? fields.qty : [fields.qty].filter(Boolean);
            const unit = Array.isArray(fields.unit) ? fields.unit : [fields.unit].filter(Boolean);
            const total = Array.isArray(fields.total) ? fields.total : [fields.total].filter(Boolean);

            const items = [];
            for (let i = 0; i < description.length; i++) {
                items.push({
                    budgetLine: budgetLine[i] || '',
                    description: description[i] || '',
                    qty: Number(qty[i] || 0),
                    unit: Number(unit[i] || 0),
                    total: Number(total[i] || 0)
                });
            }

            const newRequisition = {
                id: Date.now(),
                staffName: fields.staffName || 'Anonymous',
                requestDate: fields.requestDate || new Date().toISOString().slice(0, 10),
                department: fields.department || 'Unknown',
                items,
                attachment: files.attachment ? (files.attachment.newFilename ? `/uploads/${files.attachment.newFilename}` : files.attachment.originalFilename) : null,
                hodSignature: null,
                financeSignature: null,
                directorSignature: null,
                status: 'PENDING_HOD',
                history: [{ stage: 'Prepared', date: new Date() }]
            };

            requisitions.push(newRequisition);
            console.log("Submission received from Staff side.");

            res.redirect('/hod/dashboard');
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

    // Direct routes for each view in the views folder (for quick testing)
    app.get('/approve_form', (req, res) => {
        const sample = { id: 0, staffName: 'Demo', department: 'IT', requestDate: (new Date()).toISOString().slice(0,10), items: [{ description: 'Demo item', qty: 1, unit: 10, total: 10 }], hodSignature: null };
        res.render('approve_form', { requisition: sample });
    });

    app.get('/finance_approve', (req, res) => {
        const sample = { id: 0, staffName: 'Demo', department: 'Finance', requestDate: (new Date()).toISOString().slice(0,10), items: [{ description: 'Demo item', qty: 1, unit: 10, total: 10 }], hodSignature: null, attachment: null };
        res.render('finance_approve', { requisition: sample });
    });

    app.get('/director_approval', (req, res) => {
        const sample = { id: 0, staffName: 'Demo', department: 'Director', requestDate: (new Date()).toISOString().slice(0,10), items: [{ description: 'Demo item', qty: 1, unit: 10, total: 10 }], hodSignature: null, financeSignature: null };
        res.render('director_approval', { requisition: sample });
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


    // Route to view all pending approvals for HOD
    app.get('/hod/dashboard', (req, res) => {
        // Filter the in-memory array for requests waiting for HOD
        const pendingRequests = requisitions.filter(r => r.status === 'PENDING_HOD');
        
        // Render the EJS file and pass the data
        res.render('hod_dashboard', { requests: pendingRequests });
    });


    // app.get('/', (req,res) => {
    //     res.render('index');
    // });

    // app.get('/', (req,res) => {
    //     res.render('index');
    // });

    // app.get('/', (req,res) => {
    //     res.render('index');
    // });

    var myEventHandler = function () {
        console.log('Tuko on...');
    }


    //models for the db



    const db = require('./config/db');

    // // app.post('/submit-requisition', ... ) block removed to avoid duplicate route

    // const form = new formidable.IncomingForm();

    //     form.parse(req, async (err, fields, files) => {
    //         try {
    //             // 1. Insert the main Requisition
    //             const [result] = await db.execute(
    //                 'INSERT INTO requisitions (requestDate, department, staffName, attachmentPath) VALUES (?, ?, ?, ?)',
    //                 [fields.requestDate, fields.department, 'Brian Wekesa', files.attachment[0].originalFilename]
    //             );
                
    //             const newId = result.insertId;

    //             // 2. Insert all items (assuming they come as arrays)
    //             const itemQueries = fields.description.map((desc, i) => {
    //                 return db.execute(
    //                     'INSERT INTO requisition_items (requisition_id, description, qty, unitPrice, total) VALUES (?, ?, ?, ?, ?)',
    //                     [newId, desc, fields.qty[i], fields.unit[i], fields.total[i]]
    //                 );
    //             });

    //             await Promise.all(itemQueries);
    //             res.send("Requisition saved to MySQL!");
    //         } catch (error) {
    //             console.error(error);
    //             res.status(500).send("Database error occurred.");
    //         }
    //     });

    // This wraps your logic so 'req' and 'res' are actually provided by Express
    app.post('/submit-to-db', async (req, res) => {
        const form = new formidable.IncomingForm();

        form.parse(req, async (err, fields, files) => {
            if (err) return res.status(500).send("Form parsing error");

            try {
                // 1. Insert the main Requisition
                const [result] = await db.execute(
                    'INSERT INTO requisitions (requestDate, department, staffName, attachmentPath) VALUES (?, ?, ?, ?)',
                    [fields.requestDate, fields.department, 'Brian Wekesa', files.attachment[0].originalFilename]
                );
                
                const newId = result.insertId;

                // 2. Insert all items
                // Note: Added check to ensure fields.description is an array
                const descriptions = Array.isArray(fields.description) ? fields.description : [fields.description];
                
                const itemQueries = descriptions.map((desc, i) => {
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



//database connection and data storage
const db = require('./config/db'); // Import the connection we just made

app.post('/submit-requisition', (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).send("Error parsing form.");

        try {
            // 1. Save the main requisition record
            const [mainResult] = await db.execute(
                'INSERT INTO requisitions (staffName, requestDate, department, status) VALUES (?, ?, ?, ?)',
                [fields.staffName, fields.requestDate, fields.department, 'PENDING_HOD']
            );

            const newRequisitionId = mainResult.insertId;

            // 2. Save the individual items (looping through the arrays from the form)
            const descriptions = Array.isArray(fields.description) ? fields.description : [fields.description];
            
            for (let i = 0; i < descriptions.length; i++) {
                await db.execute(
                    'INSERT INTO requisition_items (requisition_id, description, qty, unitPrice, total) VALUES (?, ?, ?, ?, ?)',
                    [
                        newRequisitionId, 
                        descriptions[i], 
                        fields.qty[i] || 0, 
                        fields.unit[i] || 0, 
                        fields.total[i] || 0
                    ]
                );
            }

            res.redirect('/hod/dashboard');
        } catch (error) {
            console.error("DB Error:", error);
            res.status(500).send("Database saving failed.");
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
