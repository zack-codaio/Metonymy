/**
 * Created by zackaman on 4/2/15.
 */
$(document).ready(function(){
    window.tray_opened = false;
    var historical_view = false;

    var historical_stack;
    var saved_stack;

    var display_name = $("#firstHeading").text();
    var last_links = [];



    open_tray();
    init_stack();
    push_tab();

    function open_tray(){
        $('body').css({
            //"transition":"margin-right .5s",
            "margin-right":"300px"});
        $('#mw-head').css({
            //"transition":"margin-right .5s",
            "margin-right":"300px"});
        //append 400px sidebar to the right, positioned absolute

        $('body').append("<div id='rh_sidebar'>test1</div>");
        setTimeout(function(){
            $('#rh_sidebar').css({"right":"0px"});
        }, 0);

        //chrome.extension.sendRequest({cmd: "read_file"}, function(html){
        //    $("#rh_sidebar").html(html);
        //});

        $('#rh_sidebar').load(chrome.extension.getURL("tray.html"), function(){
            init();
        });
        window.tray_opened = true;
    }

    function init_stack(){
        console.log("called init_stack");
        chrome.runtime.sendMessage({greeting: "init"}, function(response){
            console.log("received init response");
            console.log(response.farewell);
        });
    }

    function push_tab(){
        chrome.runtime.sendMessage({greeting: "push_tab", display_name: display_name}, function(response){
            console.log("received push tab response");
            console.log(response.farewell);
        })
    }

    function save_tab(){
        chrome.runtime.sendMessage({greeting: "save_tab", display_name: display_name, last_links: last_links}, function(response){
            console.log("received save tab response");
            console.log(response.farewell);
            //add stack of last_links (sorted)
        })
    }

    function reset_saved_data(){
        chrome.runtime.sendMessage({greeting: "reset_saved_data"}, function(response){
            console.log("received reset_saved_data response");
            console.log(response.farewell);
        })
    }

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse){

            //deprecated
            if(request.greeting == "open_tray" && window.tray_opened == false){
                console.log("received extension started");
                $('body').css({"transition":"margin-right .5s","margin-right":"400px"});
                $('#mw-head').css({"transition":"margin-right .5s","margin-right":"400px"});
                //append 400px sidebar to the right, positioned absolute

                $('body').append("<div id='rh_sidebar'>test1</div>");
                setTimeout(function(){
                    $('#rh_sidebar').css({"right":"0px"});
                }, 0);

                $('#rh_sidebar').load(chrome.extension.getURL("tray.html"));
            }


            if(request.greeting == "close_tray" && window.tray_opened == true){
                $('body').css({"margin-right":"0"});
                $('#mw-head').css({"margin-right":"0"});
            }

            //sync stack
            if(request.greeting == "resync_stack" || request.greeting == "init_stack"){
                console.log("received resync stack command");
                console.log("history object:");
                console.log(request.wiki_stack);
                console.log("user saved pages:");
                console.log(request.user_map);

                historical_stack = request.wiki_stack;
                saved_stack = request.user_map;

                var saved_links = Object.keys(request.user_map);
                //console.log(saved_links);

                //to sort by date added
                //sort the array of keys by date added
                saved_links.sort(function(a, b){
                    //console.log(request.user_map[b].display_name + " "+request.user_map[a].display_name);
                    //console.log(request.user_map[b].last_accessed - request.user_map[a].last_accessed);
                    return(request.user_map[b].last_accessed - request.user_map[a].last_accessed);
                });
                last_links = saved_links;
                console.log(last_links);



                var links_container = $("#saved_links");
                links_container.html("");
                for(var i = 0; i < saved_links.length; i++){
                    links_container.append("<a href="+request.user_map[saved_links[i]].url+"><div class='saved_link'>"+request.user_map[saved_links[i]].display_name+"</div></a>");
                }
            }
        });




    function init(){
        $("#save_page_button").click(function(e){
            console.log("save current page to user_map");
            push_tab();
            save_tab();
        });

        $("#reset_state_button").click(function(e){
            console.log("resetting state");
            reset_saved_data();

        });


        $("#history_button").click(function(e){
           console.log("toggling history view");
            historical_view = !historical_view;
            if(historical_view){
                var saved_links = Object.keys(historical_stack);
                //console.log(saved_links);
                var links_container = $("#saved_links");
                links_container.html("");
                for(var i = 0; i < saved_links.length; i++) {
                    links_container.append("<a href=" + historical_stack[saved_links[i]].url + "><div class='saved_link'>" + historical_stack[saved_links[i]].display_name + "</div></a>");
                }
            }
            else{
                var saved_links = Object.keys(saved_stack);
                //console.log(saved_links);
                var links_container = $("#saved_links");
                links_container.html("");
                for(var i = 0; i < saved_links.length; i++) {
                    links_container.append("<a href=" + saved_stack[saved_links[i]].url + "><div class='saved_link'>" + saved_stack[saved_links[i]].display_name + "</div></a>");
                }
            }
        });



        var imgURL = chrome.extension.getURL("img/star.svg");
        document.getElementById("star_icon").src = imgURL;

        imgURL = chrome.extension.getURL("img/dice.svg");
        document.getElementById("dice_icon").src = imgURL;

        imgURL = chrome.extension.getURL("img/node.svg");
        document.getElementById("node_icon").src = imgURL;

        imgURL = chrome.extension.getURL("img/history.svg");
        document.getElementById("history_icon").src = imgURL;

    }



});