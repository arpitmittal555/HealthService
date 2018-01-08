var express = require("express");
var app = express();
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var http = require("http");
var mongoClient = require("mongodb").MongoClient;
var nodemailer = require('nodemailer');
var mongoUrl = "mongodb://127.0.0.1:27017/nagp-health-service"
var deasync = require("deasync");
var conversation = null ;
var async = require("async");
var calls = [];
var context =null ;
var firstcontext = null;
var workspace_id=null;
var istestname = false;
var isShowDoc = false;
var issendemail= false;
var previousResponse = null;
var isFirstResponse = false;
var isbooktest = false;
var db;
app.set('port', 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.use(express.static(__dirname + '/public'));

var Cloudant = require('cloudant');

var username = '490278b6-4604-4e58-bf41-2a47b7ffc7d8-bluemix'; // Set this to your own account
var password = "1d53a1370e3743bb89ec6ce749980199e0bf5b5cafd73ee8eb7e2cae3a2dbf8f";

// Initialize the library with my account.
var cloudant = Cloudant({account:username, password:password});

var doctors = cloudant.db.use("doctors_data");
var labtest = cloudant.db.use("lab_test");

app.engine('html', require('ejs').renderFile);

var server = http.createServer(app).listen(app.get("port"),function(){
    console.log("Express server listening on port " + app.get('port'));
  });
var io = require("socket.io").listen(server);

app.get("/",function(req,res){
    res.render("index.html");
})


io.sockets.on("connection",function(socket){
    console.log("socket connection");
    socket.on("chat message",function(msg){
        io.emit("chat message",msg);
    })
    socket.on("disconnect",function(){
        console.log("User Disconnected");
    })
    socket.on("submitMessage",function(msg){
        
        if(istestname){
            searchTestName(msg);
        }
        else if(isShowDoc){
            searchDoctorName(msg)
        }
        else{
            getResponse(msg);
        }

    })
    socket.on("currentlocation",function(data){
        centrepos = data.pos;
        getdoctorsdataonpos(centrepos,data.symptoms);
    })
})


function gotochatroom(res){
    res.render("chat.html");
}

app.get("/book-lab-test",function(req,res){

    // Set up Conversation service wrapper.
    conversation = new ConversationV1({
        username: '26bfa6d7-0337-4e4e-acb3-b36b9c84061f', // replace with username from service key
        password: 'agDGEAv8ky2s', // replace with password from service key
        path: { workspace_id: '1125ef92-7939-4605-b128-dd26ef1ce53b' }, // replace with workspace ID
        version_date: '2017-05-26'
    });
    
    isbooktest = true;
    workspace_id = '1125ef92-7939-4605-b128-dd26ef1ce53b';     
    gotochatroom(res);
    getfirstresponse();

}),

app.get("/find-doctor",function(req,res){

    // Set up Conversation service wrapper.
    conversation = new ConversationV1({
        username: '26bfa6d7-0337-4e4e-acb3-b36b9c84061f', // replace with username from service key
        password: 'agDGEAv8ky2s', // replace with password from service key
        path: { workspace_id: "ea83ffde-b760-4a9e-a9e6-5cafb667980d" }, // replace with workspace ID
        version_date: '2017-05-26'
    });
    isbooktest = false;
    workspace_id = 'ea83ffde-b760-4a9e-a9e6-5cafb667980d';
    gotochatroom(res);
    getfirstresponse();
    

})

function getfirstresponse(){
    isFirstResponse = true;
    conversation.message({workspace_id: workspace_id},processResponse)
}

function getResponse(msg) {

    //Action output for BOOK A LAB TEST
    if(issendemail){
        email = msg.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi)[0];
        sendemail(context,email);
        context["emailid"]=email;
        issendemail=false;
    }

    console.log(msg);

    conversation.message({
        input: { text: msg } , workspace_id: workspace_id ,context : context,
        }, processResponse)

    }

    
  function processResponse(err,response){
    if(isFirstResponse){
        firstcontext = response.context;
        isFirstResponse = false;
    }
    previousResponse = response;
    var msg = null;
    if (err) {
        console.error(err); // something went wrong
        return;
      }
    
      var endConversation = false;
    
      // If an intent was detected, log it out to the console.
      if (response.intents.length > 0) {
        console.log('Detected intent: #' + response.intents[0].intent);
      }
      
      // If an intent was detected, log it out to the console.
      if (response.entities.length > 0) {
        console.log('Detected intent: @' + response.entities[0].entity);
      }
      

        // Display the output from dialog, if any.
        if (response.output.text.length != 0) {
            console.log(response.output.text[0]);
            
            io.emit("botMessage",{message : response.output.text[0]});
            
            //Action Flag Checks for BOOK A LAB TEST
            if(response.context.action == "show_test_list"){
                istestname= true;
                
                var results = getAllLabtests();
            }
            
            if(response.context.action == "find-doctors"){
                isShowDoc = true;
                
                showDoctors(response.context.Symptom, response.context.city);
            }
            
            if(response.context.action == "invalidid"){
                isShowDoc = true;
            }


            if(response.context.action == "sendemail"){
                issendemail = true;
            }
            
        }
      
        context = response.context;

        if(response.context.action == "resetcontext"){
            context = firstcontext;
        }
  }
  
  function sendemail(response,msg){
      
      var transporter = nodemailer.createTransport({
          service: 'gmail',
      auth: {
          user: 'nagarro.jpr@gmail.com',
          pass: 'Mayank@#99'
      }
    });
    
    var mailtext;
    var subject;

if(isbooktest){

    subject = "Lab test Booking Done";
    mailtext = 'Your '+ context["testname"]+ ' has been booked on ' +context["FormattedDate"] +" at "+context["FormattedTime"] +". The Cost of the Test is "+ context["price"];
}
else{
    subject = "Doctor appointment Booking Done";
    mailtext = 'An Appointment with the '+context["docname"]+' has been booked on ' +context["FormattedDate"] +" at "+context["FormattedTime"];
}


    var mailOptions = {
        from: 'arpitmittal555@gmail.com',
        to: msg,
        subject: subject,
        text: mailtext
    };
    
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

function searchTestName(msg){
    
    var testid = msg.match(/([0-9]+)/)[0];
    var query = {
        'testid' : testid
        }
    
        labtest.find({selector:query}, function(err,data){
            var doc = data.docs[0];
            var valid = false;
                if(doc){
                    result = doc;
                    valid = true;
                }
                var testname = null;
                if(valid){
                    testname = result["name"];
                    msg = "Valid";
                    context["price"] = result.price;
                }
                else{
                    msg = "Invalid";
            }
            context["testname"] = testname;
            context["testid"] = testid;
            istestname=false;
            context["action"]="None";
            
            conversation.message({
                input: { text: msg } , workspace_id: workspace_id ,context : context,
            }, processResponse)
        })
            
};

  function getAllLabtests(){
      
    var result = null;
      labtest.find({selector:{
        "_id": {
            "$gt": "0"
         }
      }},function(err,data){
            result = data.docs;
            io.emit("showLabtests",{message : result});
      })

      return result;
  }

  function showDoctors(symptoms,city){

    var centrepos = null;
    if(city == "null"){
        io.emit("getcurrentlocation",symptoms);
    }
    else{

        var googleMapsClient = require('@google/maps').createClient({
            key: "AIzaSyALlG1nyrsaVTy_sZbCWWCzLhUx9KDJWcE"
          });

        googleMapsClient.geocode({
            address: city
          }, function(err, response) {
            centrepos = response.json.results[0].geometry.location;
            getdoctorsdataonpos(centrepos,symptoms);
          });

    }
    return null;
  }

  function getdoctorsdataonpos(centrepos,symptoms){
      var result;
    doctors.find({selector : {
        "properties": {
            "symptoms": {
                "$regex" : "(?i)"+symptoms[0]}  
         }
    }},function(err,data){
        result = data.docs;
        io.emit("showDoctorsOnMap",{ "type": "FeatureCollection", features : result , centre : centrepos});
    })

  }


  function searchDoctorName(msg){
      var doctorid = msg.match(/([0-9]+)/)[0];
        doctors.find({selector : {
            "properties": {
                "doctorid": doctorid
        }}},function(err,data){
            result = data.docs[0];
            var valid = false;
            if(data.docs){
                valid = true;
            }
        if(valid){
            docname = result.properties["name"];
            context["docname"] = docname;
            msg = "Valid";
        }
        else{
            msg = "Invalid";
        }
        isShowDoc=false;
        context["docid"] = doctorid;
        context["action"]="None";
        conversation.message({
            input: { text: msg } , workspace_id: workspace_id ,context : context,
            }, processResponse)
        })

  }