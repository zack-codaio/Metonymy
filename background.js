/**
 * Created by zackaman on 4/2/15.
 */
console.log("background.js loaded");

window.tray_open = false;


//load or build stack of URLs
var wiki_stack = {};
var user_map = {};
var number_returns = 0;


//first thing: resyncs and pushes to contentscript.js
//should: get URL and update last_accessed before pushing back
//resync_stack();

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

        if(request.greeting == "init"){

            console.log(request);

            var cur_article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/

            //check nearby connections
            get_local_holes(request.display_name);

            chrome.storage.sync.get('wiki_stack', function (data) {
                if(data.wiki_stack){
                    wiki_stack = data.wiki_stack;
                    if(wiki_stack[cur_article_key]){
                        console.log("updating wiki_stack.last_accessed for "+cur_article_key);
                        wiki_stack[cur_article_key].last_accessed = Date.now();
                    }
                }

                chrome.storage.sync.get("user_map", function(data){
                    if(data.user_map){
                        user_map = data.user_map;
                        if(user_map[cur_article_key]){
                            console.log("updating user_map.last_accessed for "+cur_article_key);
                            console.log(user_map[cur_article_key].last_accessed);
                            user_map[cur_article_key].last_accessed = Date.now();
                        }
                    }

                    chrome.storage.sync.set({'wiki_stack': wiki_stack, 'user_map' : user_map}, function() {
                        // Notify that we saved.
                        console.log('Settings saved');

                        //resync_stack();

                        //pass data to contentscript.js
                        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                            chrome.tabs.sendMessage(tabs[0].id, {greeting: "init_stack", wiki_stack: wiki_stack, user_map: user_map}, function(response) {});
                        });
                    });
                });
            });
        }

        //push URL
        if (request.greeting == "push_tab"){
            console.log(wiki_stack);
            var article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
            console.log(article_key);
            if(typeof(wiki_stack[article_key]) != "undefined"){ //if already exists
                wiki_stack[article_key].last_accessed = Date.now();
                if(typeof(user_map[article_key]) != "undefined"){
                    user_map[article_key].last_accessed = Date.now();
                }
                //console.log(wiki_stack);
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

                //resync_stack();
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

            last_links = request.last_links;
            console.log(last_links);

            number_returns = 0;

            if(last_links.length >= 1 && typeof(user_map[last_links[0]].display_name) != "undefined" && new_item.article_key != user_map[last_links[0]]){
                node_distance(new_item.display_name, user_map[last_links[0]].display_name, new_item.article_key, user_map[last_links[0]].article_key);

                number_returns++;
            }
            if(last_links.length >= 2 &&typeof(user_map[last_links[1]].display_name) != "undefined" && new_item.article_key != user_map[last_links[1]]){
                node_distance(new_item.display_name, user_map[last_links[1]].display_name, new_item.article_key, user_map[last_links[1]].article_key);

                number_returns++;
            }
            if(last_links.length >= 3 &&typeof(user_map[last_links[2]].display_name) != "undefined" && new_item.article_key != user_map[last_links[2]]){
                node_distance(new_item.display_name, user_map[last_links[2]].display_name, new_item.article_key, user_map[last_links[2]].article_key);

                number_returns++;
            }


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

function save_and_update(){
    chrome.storage.sync.set({'user_map': user_map}, function() {
        // Notify that we saved.
        console.log('Settings saved');

        resync_stack();
    });
}

//TODO:
//- function to get distance between two nodes - gets distance, but doesn't return anything after
//  query neo4js via REST api - done
//  build graph based on distances
//- function to cluster (by adding new, user defined relationships)?
//- function to suggest articles

//node_distance('Complex Number', 'Barack Obama');
//get distance between nodeA and nodeB
//takes display names of nodeA and nodeB
//return distance
function node_distance(nodeA, nodeB, keyA, keyB){
    console.log("calling node_distance with "+nodeA+" "+nodeB);
    //make ajax call to local server

    //var query="MATCH (n:User) RETURN n, labels(n) as l LIMIT {limit}"
    var query="MATCH (p0:Page {title:'"+nodeA+"'}), (p1:Page {title:'"+nodeB+"'}), p = shortestPath((p0)-[*..6]-(p1)) \r RETURN p";
    var params={title1: nodeA, title2: nodeB};
    var cb=function(err,data) { console.log(JSON.stringify(data)) }

    var postJson = {};
    var statements ={"statement":query, "parameters":params};
    postJson.statements = [statements];

    var txUrl = "http://localhost:7474/db/data/transaction/commit";
    function cypher(query,params,cb) {

        var xhr = new XMLHttpRequest();
        xhr.open("POST", txUrl, true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onreadystatechange = function(response) {
            if (xhr.readyState == 4) {
                //console.log("returned from ajax request");
                //console.log(response.target.response);
                var responseJson = JSON.parse(response.target.response);
                //console.log(responseJson);
                results_list = responseJson.results[0].data[0]["row"][0]

                results_list = count_distance(results_list);
                console.log("distance between "+nodeA+ " and "+nodeB+": "+results_list.length);
                var results_array = [];
                //send event with nodeA, nodeB, and distance between (maybe include the linkages?)

                number_returns--;
                if(number_returns == 0){
                    save_and_update()
                }

                function count_distance(results_list){
                    var new_results_array = []
                    for(var i = 0; i < results_list.length; i++){
                        if(typeof(results_list[i].title) != "undefined"){
                            new_results_array.push(results_list[i]);
                        }
                    }
                    console.log(new_results_array);
                    results_array = new_results_array;

                    update_distance(keyA, keyB, results_array);
                    return new_results_array;
                }
            }
        };
        xhr.send(JSON.stringify(postJson));

    }

    function update_distance(keyA, keyB, distanceArray){
        if(typeof(user_map[keyA].distance) == "undefined"){
            user_map[keyA].distance = {};
            user_map[keyA].distance[keyB] = distanceArray;
        }
        else{
            user_map[keyA].distance[keyB] = distanceArray;
        }

        if(typeof(user_map[keyB].distance) == "undefined"){
            user_map[keyB].distance = {};
            user_map[keyB].distance[keyA] = distanceArray.reverse();
        }
        else{
            user_map[keyB].distance[keyA] = distanceArray.reverse();
        }

        console.log(user_map);

    }

    cypher(query,params,cb);

    //
    //{"results":[
    //    {"columns":["n","l"],
    //        "data":[
    //            {"row":[{"name":"Aran"},["User"]]}
    //        ]
    //    }],
    //    "errors":[]}



    return -1;
}


//may or may not take a curNode
//work on single node first
function get_local_holes(curNode){
    //if curNode is undefined, get holes for entire graph
    //else, get holes that are most closely related to current node


    //compile a list of all connections either related to current node or to the entire graph
    //get local connections
    var immediate_connections = {};
    var query_returns = 0;
        //key: article name
        //value: sightings
    get_immediate_connections(curNode);

    //return list of all connections on a single node
    function get_immediate_connections(nodeA){
        var query="MATCH (p0:Page {title:'"+nodeA+"'})-[r:Link]->(results) RETURN results LIMIT 25";
        console.log(query);
        var params={title1: nodeA};
        var cb=function(err,data) { console.log(JSON.stringify(data)) }

        var postJson = {};
        var statements ={"statement":query, "parameters":params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query,params,cb);

        function cypher(query,params,cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    console.log("get_connections() - returned from ajax request");
                    console.log(response);

                    var responseJson = JSON.parse(response.target.response);
                    console.log(responseJson);

                    console.log(responseJson.results[0].data[0].row[0].title);
                    for(var i = 0; i < 25; i++){
                        var current_sighting = responseJson.results[0].data[i].row[0].title;
                        //check for existence
                        if(typeof(current_sighting) != "undefined"){
                            //push to immediate_connections
                            if(typeof(immediate_connections[current_sighting]) == "undefined"){
                                immediate_connections[current_sighting] = 1;
                            }
                            else{
                                immediate_connections[current_sighting] = parseInt(immediate_connections[current_sighting]) + 1;
                            }
                        }
                    }

                    //console.log(immediate_connections);

                    //branch out one level deep
                    var immediate_keys = Object.keys(immediate_connections);
                    for(var i = 0; i < 25; i++){
                        var one_deep = immediate_keys[i];
                        //check for existence
                        if(typeof(one_deep) != "undefined"){
                            query_returns++;
                            get_connections(one_deep);
                        }
                    }
                    console.log("query returns - pre");
                    console.log(query_returns);
                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }

//return list of all connections on a single node
    function get_connections(nodeA){


        var query="MATCH (p0:Page {title:'"+nodeA+"'})-[r:Link]->(results) RETURN results LIMIT 25";
        console.log(query);
        var params={title1: nodeA};
        var cb=function(err,data) { console.log(JSON.stringify(data)) }

        var postJson = {};
        var statements ={"statement":query, "parameters":params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query,params,cb);

        function cypher(query,params,cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    console.log("get_connections("+nodeA+") - returned from ajax request");
                    console.log(response);

                    query_returns--;
                    console.log("query_returns - post "+query_returns);
                    if(query_returns == 0){
                        console.log("returning compiled immediate_connections");


                        //clean up
                        //remove sightings == 1

                        var compiled_keys = Object.keys(immediate_connections);
                        //console.log(compiled_keys);
                        //console.log(compiled_keys.length);
                        for(var i = 0; i < compiled_keys.length; i++){
                            //console.log(compiled_keys[i]);
                            //console.log(i);
                            if(typeof(compiled_keys[i]) != "undefined" && immediate_connections[compiled_keys[i]] <= 1){
                                //console.log("deleting: "+compiled_keys[i]);
                                delete immediate_connections[compiled_keys[i]];
                            }
                            else{
                                //console.log(immediate_connections[compiled_keys[i]]);
                                //console.log("not deleting: "+compiled_keys[i]);
                            }
                        }

                        console.log(immediate_connections);
                        push_recommendations(immediate_connections);
                        //mark recently visited
                        //mark already saved
                    }

                    var responseJson = JSON.parse(response.target.response);
                    console.log(responseJson);

                    console.log(responseJson.results[0].data[0].row[0].title);
                    if(typeof(responseJson.results[0].data[0].row) != "undefined") {
                        for (var i = 0; i < 25; i++) {
                            var current_sighting = responseJson.results[0].data[i].row[0].title;
                            //check for existence
                            if (typeof(current_sighting) != "undefined") {
                                //push to immediate_connections
                                if (typeof(immediate_connections[current_sighting]) == "undefined") {
                                    immediate_connections[current_sighting] = 1;
                                }
                                else {
                                    immediate_connections[current_sighting] = parseInt(immediate_connections[current_sighting]) + 1;
                                }
                            }
                        }
                    }


                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }
}

function push_recommendations(recommendations){
    //pass data to contentscript.js
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {greeting: "push_recommendations", recommendations: recommendations}, function(response) {});
    });
}

