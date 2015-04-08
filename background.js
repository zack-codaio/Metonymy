/**
 * Created by zackaman on 4/2/15.
 */
console.log("background.js loaded");

window.tray_open = false;


//load or build stack of URLs
var wiki_stack = {};
var user_map = {};
resync_stack();

function resync_stack() {
    chrome.storage.sync.get('wiki_stack', function (data) {
        if(data.wiki_stack){
            wiki_stack = data.wiki_stack;
        }
    });

    chrome.storage.sync.get("user_map", function(data){
        if(data.user_map){
            user_map = data.user_map;
        }
    });


    //pass data to contentscript.js
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {greeting: "resync_stack", wiki_stack: wiki_stack, user_map: user_map}, function(response) {});
    });
}

chrome.browserAction.onClicked.addListener(function(){
    if (window.tray_open == false){
        window.tray_open = true;

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {greeting: "open_tray"}, function(response) {});
        });
    } else {
        window.tray_open = false;
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {greeting: "close_tray"}, function(response) {});
        });
    }
});

//load tray html - deprecated?
//chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
//    if(request.cmd == "read_file") {
//        $.ajax({
//            url: chrome.extension.getURL("tray.html"),
//            dataType: "html",
//            success: sendResponse
//        });
//    }
//});

//respond to messages from contentscript.js
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log(sender.tab ?
        "from a content script:" + sender.tab.url :
            "from the extension");

        //push URL
        if (request.greeting == "push_tab"){
            console.log(wiki_stack);
            var article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
            console.log(article_key);
            if(typeof(wiki_stack[article_key]) != "undefined"){ //if already exists
                wiki_stack[article_key].last_accessed = Date.now();
            }
            else{
                var new_item = {};
                new_item.display_name = request.display_name; //article title
                new_item.url = sender.tab.url; //actual URL of the article
                new_item.article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
                new_item.last_accessed = Date.now();
                new_item.first_added = Date.now(); //should add first_added
                console.log("saw "+new_item.article_key+" for the first time. Added new");
                console.log(new_item);
                wiki_stack[new_item.article_key] = new_item;

                //TODO: would be good to get refs in and links out
                //should be able to manually start on pages as well
                //could go off of firstHeading instead of by domain
            }







            chrome.storage.sync.set({'wiki_stack': wiki_stack}, function() {
                // Notify that we saved.
                console.log('Settings saved');

                resync_stack();
            });



            sendResponse({farewell: "goodbye"});
        }

        //push URL
        if (request.greeting == "save_tab"){
            var new_item = {};
            new_item.display_name = request.display_name; //article title
            new_item.url = sender.tab.url; //actual URL of the article
            new_item.article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
            new_item.last_accessed = Date.now();

            console.log(new_item);


            user_map[new_item.article_key] = new_item;

            chrome.storage.sync.set({'user_map': user_map}, function() {
                // Notify that we saved.
                console.log('Settings saved');

                resync_stack();
            });

            sendResponse({farewell: "goodbye"});
        }

        if(request.greeting == "reset_saved_data"){
            chrome.storage.sync.set({"user_map":{}, "wiki_stack":{}},resync_stack());
        }

    });