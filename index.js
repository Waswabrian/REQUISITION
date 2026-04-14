    const express = require('express');
    const session = require('express-session');
    const bcrypt = require('bcrypt');
    const db = require('./config/db');
    const formidable = require('formidable');
    const path = require('path');
    const http = require('http');

    const app = express();
    const hostname = '127.0.0.1';
    const port = process.env.PORT || 3000;

    // Helper function to parse requisition data
    function parseRequisition(requisition) {
        if (!requisition) return requisition;
        
        const parsed = { ...requisition };
        
        // Parse items
        if (parsed.items) {
            if (typeof parsed.items === 'string') {
                try {
                    parsed.items = JSON.parse(parsed.items);
                } catch(e) {
                    parsed.items = [];
                }
            }
        } else {
            parsed.items = [];
        }
        
        // Parse history
        if (parsed.history) {
            if (typeof parsed.history === 'string') {
                try {
                    parsed.history = JSON.parse(parsed.history);
                } catch(e) {
                    parsed.history = [];
                }
            }
        } else {
            parsed.history = [];
        }
        
        return parsed;
    }

    // 1. SETTINGS
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // 2. STANDARD MIDDLEWARE
    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    app.use(express.json({ limit: '50mb' }));

    // 3. SESSION INITIALIZATION
    app.use(session({
        secret: 'octagon_secret_key_2026',
        resave: false,
        saveUninitialized: false,
        cookie: { 
            maxAge: 3600000,
            httpOnly: true,
            secure: false
        },
        name: 'octagon_session'
    }));

    // 4. GLOBAL MIDDLEWARE
   // index.js - Section 4: GLOBAL MIDDLEWARE
        app.use((req, res, next) => {
            res.locals.user = (req.session && req.session.userId) ? 
                { 
                    username: req.session.username, 
                    role: req.session.role,
                    department: req.session.department, // Ensure this is stored in session during login
                    id: req.session.userId 
                } : null;
            // ... rest of middleware
            next();
        });


        
    // 5. ACCESS CONTROL MIDDLEWARE
    const isAuthenticated = (req, res, next) => {
        if (req.session && req.session.userId) {
            return next();
        }
        req.session.returnTo = req.originalUrl;
        res.redirect('/login');
    };

    const authorize = (role) => {
        return (req, res, next) => {
            if (req.session && req.session.role === role) {
                return next();
            }
            res.status(403).send(`
                <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                    <h1 style="color:#b91c1c;">Access Denied</h1>
                    <p>You do not have permission to view the ${role} dashboard.</p>
                    <p>Your role: ${req.session?.role || 'Not logged in'}</p>
                    <a href="/">Go Back to Home</a>
                </div>
            `);
        };
    };

    function redirectToDashboard(role, res) {
        switch(role) {
            case 'hod':
                return res.redirect('/hod/dashboard');
            case 'finance':
                return res.redirect('/finance/dashboard');
            case 'director':
                return res.redirect('/director/dashboard');
            default:
                return res.redirect('/home');
        }
    }

    // 6. AUTHENTICATION ROUTES
    app.get('/login', (req, res) => {
        if (req.session && req.session.userId) {
            return redirectToDashboard(req.session.role, res);
        }
        res.render('login', { error: null });
    });

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        
        console.log('\n=================================');
        console.log(`Login attempt for: ${username}`);
        console.log('=================================');
        
        if (!username || !password) {
            return res.render('login', { error: "Please enter both username and password" });
        }
        
        try {
            const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
            const user = rows[0];
            
            if (!user) {
                console.log('User not found');
                return res.render('login', { error: "Invalid username or password" });
            }
            
            console.log(`User found: ${user.username} (${user.role})`);
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            console.log(`Password match: ${passwordMatch}`);
            
            if (passwordMatch) {
                req.session.userId = user.id;
                req.session.role = user.role;
                req.session.username = user.username;
                console.log(`✅ Login successful for: ${username}`);
                const returnTo = req.session.returnTo || '/';
                delete req.session.returnTo;
                return redirectToDashboard(user.role, res);
            }
            
            console.log('❌ Invalid password');
            res.render('login', { error: "Invalid username or password" });
            
        } catch (err) {
            console.error('❌ Login error:', err);
            res.render('login', { error: "A server error occurred. Please try again." });
        }
    });

    app.get('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.log("Logout error:", err);
            }
            res.clearCookie('octagon_session');
            res.redirect('/login');
        });
    });

    // 7. ROOT ROUTE
    app.get('/', isAuthenticated, (req, res) => {
        redirectToDashboard(req.session.role, res);
    });

    // 8. STAFF ROUTES
    app.get('/home', isAuthenticated, async (req, res) => {
        try {
            const [rows] = await db.execute(
                'SELECT id, staffName, department, requestDate, status FROM requisitions ORDER BY requestDate DESC LIMIT 10'
            );
            res.render('index', { 
                currentPage: 'new', 
                user: req.session.username, 
                requisitions: rows
            });
        } catch (error) {
            console.error('Error loading home page:', error);
            res.render('index', { 
                currentPage: 'new', 
                user: req.session.username, 
                requisitions: [],
                error: "Could not load requisitions"
            });
        }
    });

  app.post('/requisition/submit-to-hod', isAuthenticated, async (req, res) => {
    try {
        // Match names exactly as they appear in your HTML
       const { requestDate, department, grandTotal, staffName } = req.body;

// Normalize fields (ensure arrays)
const budgetLines = Array.isArray(req.body.budgetLine) ? req.body.budgetLine : [req.body.budgetLine];
const costCentres = Array.isArray(req.body.costCentre) ? req.body.costCentre : [req.body.costCentre];
const descriptions = Array.isArray(req.body.description) ? req.body.description : [req.body.description];
const qtys = Array.isArray(req.body.qty) ? req.body.qty : [req.body.qty];
const units = Array.isArray(req.body.unit) ? req.body.unit : [req.body.unit];
const totals = Array.isArray(req.body.total) ? req.body.total : [req.body.total];

// Build items correctly (index-based mapping)
        const items = descriptions.map((desc, i) => ({
            budgetLine: budgetLines[i] || '',
            costCentre: costCentres[i] || '',
            description: desc || '',
            qty: Number(qtys[i]) || 0,
            unitPrice: Number(units[i]) || 0,
            total: Number(totals[i]) || 0
        }));
        console.log(items)

        const history = [{ 
            stage: 'Prepared', 
            date: new Date().toISOString(), 
            user: req.session.username 
        }];

        await db.execute(
            'INSERT INTO requisitions (staffName, requestDate, department, items, grandTotal, status, history) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [staffName || req.session.username, requestDate || new Date(), department, JSON.stringify(items), grandTotal, 'PENDING_HOD', JSON.stringify(history)]
        );

        res.redirect('/home?success=Requisition submitted successfully');
    } catch (error) {
        console.error('Error saving requisition:', error);
        res.status(500).send(`Error saving requisition: ${error.message}`);
    }
});
    // 9. HOD ROUTES
    app.get('/hod/dashboard', isAuthenticated, authorize('hod'), async (req, res) => {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM requisitions WHERE status = ? ORDER BY requestDate DESC',
                ['PENDING_HOD']
            );
            
            const parsedRequests = rows.map(req => {
                const parsed = parseRequisition(req);
                parsed.totalAmount = parsed.items.reduce((sum, item) => {
                    return sum + (Number(item.total) || Number(item.qty) * Number(item.unitPrice) || 0);
                }, 0);
                parsed.daysPending = Math.ceil((new Date() - new Date(parsed.requestDate)) / (1000 * 60 * 60 * 24));
                return parsed;
            });
            
            const totalPending = parsedRequests.length;
            const highValueItems = parsedRequests.filter(r => r.totalAmount > 100000).length;
            const urgentRequests = parsedRequests.filter(r => r.daysPending > 3).length;
            
            res.render('hod_dashboard', { 
                requisitions: parsedRequests,
                stats: {
                    total: totalPending,
                    highValue: highValueItems,
                    urgent: urgentRequests
                },
                currentPage: 'hod',
                user: req.session.username,
                role: 'hod'
            });
            
        } catch (error) {
            console.error('Error loading HOD dashboard:', error);
            res.render('hod_dashboard', { 
                requests: [], 
                role: 'hod',
                department: req.session.department || 'General',
                stats: { total: 0, highValue: 0, urgent: 0 },
                currentPage: 'hod',
                user: req.session.username,
                error: "Could not load requisitions: " + error.message
            });
        }
    });

    app.get('/hod/approval/:id', isAuthenticated, authorize('hod'), async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
            
            if (!rows || rows.length === 0) {
                return res.status(404).send("Requisition not found");
            }
            
            const requisition = parseRequisition(rows[0]);
            
            if (requisition.status !== 'PENDING_HOD') {
                return res.status(400).send(`
                    <div style="text-align:center; margin-top:50px;">
                        <h2>Requisition Already Processed</h2>
                        <p>Status: ${requisition.status}</p>
                        <a href="/hod/dashboard">Back to Dashboard</a>
                    </div>
                `);
            }
            
            const subtotal = requisition.items.reduce((sum, item) => {
                return sum + (Number(item.total) || Number(item.qty) * Number(item.unitPrice) || 0);
            }, 0);
            
            res.render('approve_form', {
                requisition: {
                    ...requisition,
                    subtotal: subtotal,
                    grandTotal: subtotal,
                    history: requisition.history || []
                },
                currentPage: 'hod',
                user: req.session.username,
                role: 'hod'
            });
            
        } catch (error) {
            console.error('Error loading approval form:', error);
            res.status(500).send(`Error loading requisition: ${error.message}`);
        }
    });

    app.post('/hod/submit-approval/:id', isAuthenticated, authorize('hod'), async (req, res) => {
        const { id } = req.params;
        const { action, comments, signature } = req.body;
        
        console.log('Processing HOD approval:', { id, action });
        
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).send("Invalid action. Must be 'approve' or 'reject'.");
        }
        
        if (!signature) {
            return res.status(400).send("Signature is required.");
        }
        
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [id]);
            
            if (rows.length === 0) {
                return res.status(404).send("Requisition not found");
            }
            
            const requisition = rows[0];
            
            if (requisition.status !== 'PENDING_HOD') {
                return res.status(400).send(`Requisition already processed. Current status: ${requisition.status}`);
            }
            
            let history = [];
            if (requisition.history) {
                try {
                    history = typeof requisition.history === 'string' ? 
                        JSON.parse(requisition.history) : 
                        (requisition.history || []);
                } catch(e) {
                    history = [];
                }
            }
            
            const newStatus = action === 'approve' ? 'PENDING_FINANCE' : 'REJECTED_BY_HOD';
            
            const historyEntry = {
                stage: 'HOD Approval',
                action: action === 'approve' ? 'Approved' : 'Rejected',
                date: new Date().toISOString(),
                user: req.session.username,
                signature: signature.substring(0, 100),
                timestamp: Date.now()
            };
            
            if (comments) {
                historyEntry.comments = comments;
            }
            
            history.push(historyEntry);
            
            const updateQuery = 'UPDATE requisitions SET status = ?, hodSignature = ?, history = ? WHERE id = ?';
            const updateValues = [newStatus, signature, JSON.stringify(history), id];
            
            await db.execute(updateQuery, updateValues);
            
            console.log(`✅ HOD ${action}d requisition ${id}`);
            
            const message = action === 'approve' 
                ? '✅ Requisition approved and sent to Finance' 
                : '❌ Requisition rejected';
            
            res.redirect(`/hod/dashboard?success=${encodeURIComponent(message)}`);
            
        } catch (error) {
            console.error('❌ Error processing HOD approval:', error);
            res.status(500).send(`Error processing approval: ${error.message}`);
        }
    });


    app.get('/finance/dashboard', isAuthenticated, authorize('finance'), async (req, res) => { 
        try { 
            // Get pending finance requisitions 
            const [pendingRows] = await db.execute( 
                'SELECT * FROM requisitions WHERE status = ? ORDER BY requestDate DESC', 
                ['PENDING_FINANCE'] 
            ); 
            
            // Get ALL requisitions for tracking view 
            const [allRows] = await db.execute( 
                'SELECT * FROM requisitions ORDER BY requestDate DESC' 
            ); 
            

            // Get department statistics
            const [deptStats] = await db.execute(`
                SELECT 
                    department,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'PENDING_FINANCE' OR status = 'PENDING_HOD' OR status = 'PENDING_DIRECTOR' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status LIKE 'REJECTED%' THEN 1 ELSE 0 END) as rejected,
                    SUM(grandTotal) as totalValue
                FROM requisitions 
                GROUP BY department
                ORDER BY totalValue DESC
            `);
            // Get unique departments for filter
            const [deptList] = await db.execute('SELECT DISTINCT department FROM requisitions WHERE department IS NOT NULL AND department != ""');
            const departments = deptList.map(d => d.department);
            
            // Parse pending requisitions 
            const parsedPending = pendingRows.map(req => { 
                const parsed = parseRequisition(req); 
                parsed.totalAmount = parsed.items.reduce((sum, item) => { 
                    return sum + (Number(item.total) || Number(item.qty) * Number(item.unitPrice) || 0); 
                }, 0); 
                return parsed; 
            }); 
            
            // Parse all requisitions 
            const parsedAll = allRows.map(req => { 
                const parsed = parseRequisition(req); 
                parsed.totalAmount = parsed.items.reduce((sum, item) => { 
                    return sum + (Number(item.total) || Number(item.qty) * Number(item.unitPrice) || 0); 
                }, 0); 
                return parsed; 
            }); 
            
            // Calculate comprehensive stats
            const totalValue = parsedAll.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
            
            const stats = { 
                highValue: parsedAll.filter(r => r.grandTotal > 100000).length,
                pendingFinance: parsedPending.length,
                pendingDirector: parsedAll.filter(r => r.status === 'APPR').length,
                fullyApproved: parsedAll.filter(r => r.status === 'APPROVED').length,
                rejected: parsedAll.filter(r => r.status.includes('REJECTED')).length,
                totalValue: totalValue
            }; 
            
        res.render('finance_dashboard', { 
            requisitions: parsedPending,
            allRequisitions: parsedAll,
            highValue: parsedAll.filter(r => r.grandTotal > 100000).length,
            departmentStats: deptStats,
            departments: departments,  // Add this line
            stats: stats,
            currentPage: 'finance',
            user: req.session.username
        });
        } catch (error) { 
            console.error('Error loading finance dashboard:', error); 
            res.render('finance_dashboard', { 
                requisitions: [], 
                allRequisitions: [], 
                departmentStats: [],
                stats: { 
                    pendingFinance: 0,
                    pendingDirector: 0,
                    fullyApproved: 0,
                    rejected: 0,
                    totalValue: 0
                }, 
                currentPage: 'finance', 
                user: req.session.username, 
                error: "Could not load requisitions" 
            }); 
        } 
    });




    app.get('/finance/approval/:id', isAuthenticated, authorize('finance'), async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
            if (!rows[0]) return res.status(404).send("Requisition not found");
            
            
            const reqData = parseRequisition(rows[0]);
            
            res.render('approve_form', { 
                requisition: reqData, 
                currentPage: 'finance',
                user: req.session.username,
                role: 'finance'
            });
        } catch (error) {
            console.error('Error loading finance approval:', error);
            res.status(500).send(`Error loading requisition: ${error.message}`);
        }
    });

    app.post('/finance/submit-approval/:id', isAuthenticated, authorize('finance'), async (req, res) => {
        const { id } = req.params;
        const { signature, action, comments } = req.body;
        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED_BY_FINANCE';
        
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [id]);
            if (rows.length === 0) return res.status(404).send("Requisition not found");
            
            let history = [];
            try {
                history = typeof rows[0].history === 'string' ? JSON.parse(rows[0].history || '[]') : rows[0].history || [];
            } catch(e) {
                history = [];
            }
            
            history.push({
                stage: action === 'approve' ? 'Approved by Finance' : 'Rejected by Finance',
                date: new Date().toISOString(),
                user: req.session.username,
                comments: comments || '',
                signature: signature || ''
            });
            
            await db.execute(
                'UPDATE requisitions SET status = ?, financeSignature = ?, history = ? WHERE id = ?',
                [newStatus, signature || 'approved', JSON.stringify(history), id]
            );
            
            res.redirect('/finance/dashboard?success=Finance approval submitted');
        } catch (error) {
            console.error('Error processing finance approval:', error);
            res.status(500).send(`Error processing approval: ${error.message}`);
        }
    });

    // 11. DIRECTOR ROUTES
    // 11. DIRECTOR ROUTES

    // Director Dashboard Route
    // index.js - Section 11: DIRECTOR ROUTES
    // index.js - Section 11: DIRECTOR ROUTES
    // index.js - Section 11: DIRECTOR ROUTES

// 11. DIRECTOR ROUTES - UPDATED WITH DEBUGGING AND FORCED REFRESH

// Director Dashboard Route - WITH IMPROVED DEBUGGING
app.get('/director/dashboard', isAuthenticated, authorize('director'), async (req, res) => {
    try {
        // 1. Get ALL approved requisitions for the table
        const [rows] = await db.execute(
            'SELECT * FROM requisitions WHERE status = ? ORDER BY requestDate DESC',
            ['APPROVED']
        );

        // 2. Get Department Aggregated Stats directly from DB for the Charts
        // This is much faster than looping in JS
        const [deptRows] = await db.execute(`
            SELECT 
                IFNULL(department, 'Uncategorized') as dept, 
                SUM(grandTotal) as totalAmount, 
                COUNT(*) as reqCount 
            FROM requisitions 
            WHERE status = 'APPROVED' 
            GROUP BY department
        `);

        // 3. Process the table rows (Parsing JSON fields if necessary)
        const parsedRequests = rows.map(req => {
            // Using your existing parseRequisition helper
            const parsed = typeof parseRequisition === 'function' ? parseRequisition(req) : req;
            
            // Ensure grandTotal is treated as a number for JS calculations
           parsed.grandTotal = parseFloat(req.grandTotal) || 0;
            return parsed;
        });

        // 4. Prepare data for Charts
        const deptNames = deptRows.map(r => r.dept);
        const deptAmounts = deptRows.map(r => Number(r.totalAmount) || 0);
        const deptCounts = deptRows.map(r => r.reqCount);

        // 5. Calculate High-Level Stats
        const totalSpendAll = deptAmounts.reduce((a, b) => a + b, 0);
        const highValueCount = parsedRequests.filter(r => r.grandTotal > 100000).length;
        const avgSpend = parsedRequests.length > 0 ? (totalSpendAll / parsedRequests.length).toFixed(0) : 0;

        console.log(`📊 Dashboard Stats: Total KES ${totalSpendAll}, Depts: ${deptNames.length}`);

        // Add cache-control headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // 6. Render
      // index.js - Inside the /director/dashboard route
res.render('director_dashboard', { 
    visibleRequisitions: parsedRequests,
    requisitions: parsedRequests,
    deptNames,
    deptAmounts,
    deptCounts,
    stats: { 
        total: parsedRequests.length, 
        highValue: highValueCount,
        totalSpend: totalSpendAll,
        avgSpend: avgSpend
    },
    // Add this line to provide a global report timestamp
    reportDate: new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }),
    user: req.session.username,
    success: req.query.success,
    error: req.query.error,
    timestamp: Date.now() // Keep for cache busting
});

    } catch (error) {
        console.error('❌ Error loading director dashboard:', error);
        res.render('director_dashboard', { 
            visibleRequisitions: [],
            requisitions: [],
            deptNames: [],
            deptAmounts: [],
            deptCounts: [],
            stats: { total: 0, highValue: 0, totalSpend: 0, avgSpend: 0 },
            user: req.session.username,
            error: "Failed to load director analytics: " + error.message
        });
    }
});

    // Director Review Detail Route (THIS WAS MISSING A PROPER ROUTE DECLARATION)
    app.get('/director/review/:id', isAuthenticated, authorize('director'), async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
            
            if (rows.length === 0) {
                return res.status(404).send("Requisition not found");
            }

            const requisition = parseRequisition(rows[0]);

            res.render('director_review_detail', {
                requisition: requisition,
                currentPage: 'director',
                user: req.session.username
            });
        } catch (error) {
            console.error('Error loading director review page:', error);
            res.status(500).send("Internal Server Error");
        }
    });

    // Director Approval Form
    app.get('/director/approval/:id', isAuthenticated, authorize('director'), async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
            if (!rows[0]) return res.status(404).send("Requisition not found");
            
            const requisition = parseRequisition(rows[0]);
            
            if (requisition.status !== 'PENDING_DIRECTOR') {
                return res.status(400).send(`
                    <div style="text-align:center; margin-top:50px;">
                        <h2>Requisition Already Processed</h2>
                        <p>Status: ${requisition.status}</p>
                        <a href="/director/dashboard">Back to Dashboard</a>
                    </div>
                `);
            }
            
            const subtotal = requisition.items.reduce((sum, item) => {
                return sum + (Number(item.total) || Number(item.qty) * Number(item.unitPrice) || 0);
            }, 0);
            
            res.render('approve_form', {
                requisition: {
                    ...requisition,
                    subtotal: subtotal,
                    grandTotal: subtotal,
                    history: requisition.history || []
                },
                currentPage: 'director',
                user: req.session.username,
                role: 'director'
            });
            
        } catch (error) {
            console.error('Error loading director approval:', error);
            res.status(500).send(`Error loading requisition: ${error.message}`);
        }
    });


    app.get('/requisition/view/:id', isAuthenticated, async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [req.params.id]);
            
            if (rows.length === 0) return res.status(404).send('Requisition not found');

            // Use your helper to parse the JSON history string into an array
            const requisition = parseRequisition(rows[0]);

            res.render('view_details', { 
                requisition: requisition, 
                user: req.session.username 
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    });



    app.post('/director/submit-approval/:id', isAuthenticated, authorize('director'), async (req, res) => {
        const { id } = req.params;
        const { signature, action, comments } = req.body;
        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED_BY_DIRECTOR';
        
        try {
            const [rows] = await db.execute('SELECT * FROM requisitions WHERE id = ?', [id]);
            if (rows.length === 0) return res.status(404).send("Requisition not found");
            
            let history = [];
            try {
                history = typeof rows[0].history === 'string' ? JSON.parse(rows[0].history || '[]') : rows[0].history || [];
            } catch(e) {
                history = [];
            }
            
            history.push({
                stage: action === 'approve' ? 'Approved by Director' : 'Rejected by Director',
                date: new Date().toISOString(),
                user: req.session.username,
                comments: comments || '',
                signature: signature || ''
            });
            
            await db.execute(
                'UPDATE requisitions SET status = ?, directorSignature = ?, history = ? WHERE id = ?',
                [newStatus, signature || 'approved', JSON.stringify(history), id]
            );
            
            res.redirect('/director/dashboard?success=Final approval submitted');
        } catch (error) {
            console.error('Error processing director approval:', error);
            res.status(500).send(`Error processing approval: ${error.message}`);
        }
    });// 12. ERROR HANDLING
    app.use((req, res) => {
        res.status(404).send(`
            <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
                <h1>404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/">Go Home</a>
            </div>
        `);
    });

    // 13. SERVER START
    const server = http.createServer(app);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ Port ${port} is already in use!`);
            console.error('\nSolutions:');
            console.error('1. Kill existing Node processes:');
            console.error('   Stop-Process -Name node -Force');
            console.error('\n2. Use a different port:');
            console.error('   $env:PORT=3001; node index.js');
            process.exit(1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, hostname, () => {
        console.log(`\n✅ Octagon Portal Active: http://${hostname}:${port}/`);
        console.log('\n🔐 Login credentials:');
        console.log('   Username: hod, finance, director, staff, brian');
        console.log('   Password: password123');
        console.log('\n📋 Available routes:');
        console.log('   /login - Login page');
        console.log('   /home - Staff requisition form');
        console.log('   /hod/dashboard - HOD dashboard');
        console.log('   /finance/dashboard - Finance dashboard');
        console.log('   /director/dashboard - Director dashboard');
        console.log('\n');
    });