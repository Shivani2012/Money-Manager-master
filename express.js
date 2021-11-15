const express = require('express');
const Handlebars = require('handlebars')
const hbs = require('express-handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');

const User = require('./model/user');
const Income = require('./model/income');
const Expense = require('./model/expense');
const Category = require('./model/category');

//creating express application
const app = express();

//create and start node server
app.listen(3000, () => {
	console.log("Server started");
});

app.engine('hbs', hbs({
	extname: 'hbs',
	defaultLayout: 'mainLayout',
	layoutsDir: __dirname +'/views/layouts/',
	handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine','hbs');

app.use(function(req, res, next) {
	res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
	next();
});

//configure body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended:false
}));

//To serve static content
app.use(express.static('public'));

app.use(session({secret:"1234567"}));

const URL = "mongodb://localhost:27017/Money_Manager";
mongoose.connect(URL, { useNewUrlParser: true, useUnifiedTopology: true });

var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  	service: 'gmail',
  	auth: {
    user: 'jn08503@gmail.com',
    pass: 'jn@dws12'
  },
  tls: { rejectUnauthorized: false }
});

app.get('/', (request, response) => {
	response.render('Index', {layout: 'mainLayoutBeforeLogin'});
});

app.get('/Login', (request, response) => {
	response.render('Login', {layout: 'mainLayoutBeforeLogin'});
});

app.get('/SignUp', (request, response) => {
	response.render('SignUp', {layout: 'mainLayoutBeforeLogin'});
});

app.post('/SignUp', (request, response) => {
	var newUser = new User({
		name:request.body.name,
		email:request.body.email,
		code:request.body.code
	});
	newUser.save().then(data => {
		response.render('Login', {msg:'Account created successfully...', 
								msgType:'alert-success', 
								layout: 'mainLayoutBeforeLogin'});
	});
});

app.get('/forgetPwd', (request, response) => {
	response.render('FindEmail', {layout: 'mainLayoutBeforeLogin'});
});

app.post('/FindMail', (request, response) => {
	User.findOne({name:request.body.name}, (err, result) => {
		if(result) {
			var msg = 'Hi ' +result.name 
      					  +',\n\nWe have received a request to reset your Money Manager password.'
      					  +'\nClick on the following link to reset password: \n'
      					  +"http://localhost:3000/ChangePwd?id="+result.id;
			var mailOptions = {
     	 		from: 'jn08503@gmail.com',
      			to: result.email,
      			subject: 'Money Manager change password link',
      			text: msg
    		};
    		transporter.sendMail(mailOptions, function(err, info) {
      			if(err) throw err;
        		console.log('link sent: ' + info.response);
        		response.render('MailSent', {email: result.email, layout: 'mainLayoutBeforeLogin'});
    		});
		} else {
			response.render('FindEmail', {msg:'Wrong answer ..', layout: 'mainLayoutBeforeLogin'})
		}
	});
});

app.get('/ChangePwd', (request, response) => {
	response.render('ChangePwd', {id:request.query.id, layout: 'mainLayoutBeforeLogin'});
});

app.post('/UpdatePwd', (request, response) => {
	User.updateOne(request.body.id, {code:request.body.code}, (err) => {
		if(err) throw err;
		else
			response.render('Login', {msg:'Password changed successfully', 
									msgType:'alert-success', 
									layout: 'mainLayoutBeforeLogin'})
	});
});

app.post('/Login', (request, response) => {
	User.findOne({code:request.body.code}, (err, result) => {
		if(result) {
			request.session.id = result.email;
			response.redirect('/Home?showMonth=current');
		} else {
			response.render('Login', {msg:'Login fail', 
									msgType:'alert-danger', 
									layout: 'mainLayoutBeforeLogin'})
		}
	});
});

app.get('/Home', (request, response) => {
	if(request.session.id) {
		var showMonth = request.query.showMonth;
		var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		var month, year;
		var incomeTotal = 0, expenseTotal = 0, incomePercent, expensePercent, total;
		if(showMonth == 'current') {
			request.session.date = new Date();
			month = monthNames[request.session.date.getMonth()];
			year = request.session.date.getFullYear();
		} else if(showMonth == 'previous') {
			var d = new Date(request.session.date);
			var oldMonth = d.getMonth();
			d.setMonth(oldMonth - 1);
			request.session.date = d;
			month = monthNames[request.session.date.getMonth()];
			year = request.session.date.getFullYear()
		} else {
			var d = new Date(request.session.date);
			var oldMonth = d.getMonth();
			d.setMonth(oldMonth + 1);
			request.session.date = d;
			month = monthNames[request.session.date.getMonth()];
			year = request.session.date.getFullYear()
		}
		Income.find({month:month, year:year}, 'amount', (err, result) => {
			if(err) throw err;
			else {
				if(result.length > 0) {
					result = result.map((element) => {return Number(element.amount);});
					incomeTotal = result.reduce((total, num) => {
						return total + num;
					});
				}
				// console.log(month +' '+ year);
				// console.log(typeof month);
				// console.log(typeof year);
				Expense.aggregate([{$match:{month:month,year:year.toString()}},{$lookup:
			 		{from:"categories",
					   localField:"cid",
					   foreignField:"_id",
					   as:"data"}
			 		}
					], (err, expenses) => {
						if(err) throw err;
						else {
							if(expenses.length > 0) {
								expenseAmountArr = expenses.map((element) => { return Number(element.amount); });
								expenseTotal = expenseAmountArr.reduce((total, num) => {
									return total + num;
								});
							}
							total = incomeTotal + expenseTotal;
							if(total == 0)
								incomePercent = expensePercent = 50;
							else {
								incomePercent = incomeTotal / total * 100;
								expensePercent = 100 - incomePercent;
							}
							if(request.query.snackbarMsg) {
								response.render('Home', {
												month:month,
												year:year,
												incomePercent:incomePercent,
												expensePercent:expensePercent,
												incomeTotal:incomeTotal,
												expenseTotal:expenseTotal,
												expenses:expenses,
												snackbarMsg:request.query.snackbarMsg
												});
							} else {
								response.render('Home', {
												month:month,
												year:year,
												incomePercent:incomePercent,
												expensePercent:expensePercent,
												incomeTotal:incomeTotal,
												expenseTotal:expenseTotal,
												expenses:expenses
												});
							}
						}
				});
			}
		});
	} else
		response.redirect('/'); 
});

app.get('/AddExpense', (request, response) => {
	if(request.session.id) {
		var expense = 'expense';
		console.log(request.session.date);	
		Category.find({type:expense}, (err, result) => {
			response.render('AddExpenseForm', {expensesCategories:result});
		});
	} else
		response.redirect('/');
});

app.get('/AddIncome', (request, response) => {
	if(request.session.id) {
		var income = 'income';
		Category.find({type:income}, (err, result) => {
			// var date = mongoose.Types.ObjectId(result[0].id).getTimestamp();
			response.render('AddIncomeForm', {incomeCategories:result});
		});
	} else
		response.redirect('/');
});

app.post('/AddExpense', (request, response) => {
	if(request.session.id) {
		var date = new Date(request.body.date);
		var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		var month = monthNames[date.getMonth()];
		var year = date.getFullYear();
		var category = request.body.category;
		Category.findOne({name:category}, (err, result) => {
			if(err) throw err;
			else {
				// console.log('result.cid' +result.id);
				var newExpense = new Expense({
					date:date,
					month:month,
					year:year,
					cid:result.id,
					amount:request.body.amount,
					notes:request.body.notes
				});
				newExpense.save().then(data => {
					response.redirect('/Home?showMonth=current&snackbarMsg=Tranaction+saved');
				});
			}
		});
	} else
		response.redirect('/');
});

app.post('/AddIncome', (request, response) => {
	if(request.session.id) {
		var date = new Date(request.body.date);
		var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		var month = monthNames[date.getMonth()];
		var year = date.getFullYear();
		var category = request.body.category;
		Category.findOne({name:category}, (err, result) => {
			if(err) throw err;
			else {
				// console.log('result.cid' +result.id);
				var newIncome = new Income({
					date:date,
					month:month,
					year:year,
					cid:result.id,
					amount:request.body.amount,
					notes:request.body.notes
				});
				newIncome.save().then(data => {
					response.redirect('/Home?showMonth=current&snackbarMsg=Tranaction+saved');
				});
			}
		});
	} else
		response.redirect('/');
});

app.get('/generateChart', (request, response) => {
	if(request.session.id) {
		var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		var d = new Date(request.session.date);
		var month = monthNames[d.getMonth()];
		var year = d.getFullYear().toString();
		Expense.aggregate([
			{$lookup:{from:"categories",localField:"cid",foreignField:"_id",as:"data"}},
			{$match:{month:month,year:year}},{$group:{_id:"$data.name", amt_sum:{$sum:"$amount"}}}
			], (err, result) => {
			if(err) throw err;
			else
				response.render('pieChart', {expenses: result});
		});
	} else
	response.redirect('/');
});

app.get('/Logout', (request, response) => {
	if(request.session.id) {
		request.session.destroy();
		response.redirect('/');
	} else
		response.redirect('/');
});

//for using our error
app.use(function(request, response) {
	response.status(404);
	response.render('404', {title: '404: Requested Page Not Found'});
});