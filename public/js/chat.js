var chatForm = $("#chatform");
var message = $("textarea#message");
var chats = $("#chatList")
var socket = io();
message.keypress(function(e){

    if(e.which == 13) {
        e.preventDefault();
        chatForm.trigger('submit');
    }

});

chatForm.on("submit",function(event){

    event.preventDefault();

    if(message.val().trim().length){

        createChatMessage(message.val(),"me");

    }

    scrollToBottom();
    
    socket.emit("submitMessage",message.val());

    message.val("");

    //getResponse(message.val());

});


function createChatMessage(msg,user){
    var li = $(
        '<li class=' + user + '>'+
            '<p></p>' +
        '</li>');

    li.find('p').text(msg);
    chats.append(li)
    scrollToBottom();
}

function showLabtests(json){
    var li = $(
        '<li class="bot">'+'<table></table>'+
        '</li>');

        var list = "<tr><th>Test Id</th><th>Test Name</th><th>Procedure</th><th>Test Cost</th></tr>";
        $.each(json.message, function(idx, obj) {
            list +="<tr><td>"+obj["testid"]+"</td><td>"+obj["name"]+"</td><td>"+obj["procedure"]+"</td><td>"+obj["cost"]+"</td></tr>";
        });

    li.find('table').html(list);
    chats.append(li)
    scrollToBottom();
}
function scrollToBottom(){
    $("html, body").animate({ scrollTop: $(document).height()},1000);
}

socket.on("botMessage",function(data){
    createChatMessage(data.message,"bot");
})

socket.on("showLabtests",function(data){
    showLabtests(data);
})

socket.on("getcurrentlocation",function(data){
    var pos ;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
          pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          socket.emit("currentlocation",{"pos" : pos, "symptoms" : data});
        });
    }

});

socket.on("showDoctorsOnMap",function(data){
    showDoctorsonMap(data);
})

function showDoctorsonMap(data){
    $("#map").remove();
    var li = $(
        '<li class="bot">'+'<div id="map" style="width: 500; height: 500"></div>'+
        '</li>');
        
        chats.append(li);
        
        map = new google.maps.Map(document.getElementById("map"), {
            center: data.centre,
            zoom: 10,
        });

    var marker = new google.maps.Marker({
        position : data.centre,
        map:map
    });
    const infoWindow = new google.maps.InfoWindow({
        content : "Current location"
    });
    
    marker.addListener("mouseover",function(){
        infoWindow.open(map,marker);
    })

        $.each(data.features, function(idx, obj) {
            createMarker(obj,map);
        });
        

        //  var li = $(
        //     '<li class="bot">'+'<table></table>'+
        //     '</li>');
    
        //     var list = "<tr><th>Doctor Id</th><th>Doctor Name</th></tr>";
        //     $.each(data.features, function(idx, obj) {
        //         list +="<tr><td>"+obj.properties["doctorid"]+"</td><td>"+obj.properties["name"]+"</td></tr>";
        //     });
    
        // li.find('table').html(list);
        // chats.append(li)

    scrollToBottom();
}


function createMarker(obj,map) {
    var longitude = obj.geometry.coordinates.lng;
    var latitude = obj.geometry.coordinates.lat;
    var pos = {
        lat: latitude,
        lng: longitude
      }
    var marker = new google.maps.Marker({
        position : pos,
        map:map
    });
    const infoWindow = new google.maps.InfoWindow({
        content : obj.properties['name'] + "(id : "+obj.properties['doctorid']+")",
        doctorid : obj.properties['doctorid']
    });
    
    marker.addListener("mouseover",function(){
        infoWindow.open(map,marker);
    })
    marker.addListener("click",function(){
       message.val(infoWindow.content.replace("[^0-9]+",""));
    })
  }