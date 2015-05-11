/**
 * Created by zackaman on 4/2/15.
 */
console.log("background.js loaded");

window.tray_open = false;


//load or build stack of URLs
var wiki_stack;
var user_map = {};
var number_returns = 0;
var ignore_list = ["Bosnian language"];
var tfReturn = 0;
var idfReturn = 0;
var globalTF = {};
var globalIDF = {}
var globalTFIDF = {};
var tabID = {};


//first thing: resyncs and pushes to contentscript.js
//should: get URL and update last_accessed before pushing back
//resync_stack();


function resync_stack() {
    chrome.storage.local.get('wiki_stack', function (data) {
        if (data.wiki_stack) {
            wiki_stack = data.wiki_stack;
        }
    });

    chrome.storage.local.get("user_map", function (data) {
        if (data.user_map) {
            user_map = data.user_map;
        }
    });

    //pass data to contentscript.js
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            greeting: "resync_stack",
            wiki_stack: wiki_stack,
            user_map: user_map
        }, function (response) {
        });
    });
}

chrome.browserAction.onClicked.addListener(function () {
    if (window.tray_open == false) {
        window.tray_open = true;

        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {greeting: "open_tray"}, function (response) {
            });
        });
    } else {
        window.tray_open = false;
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {greeting: "close_tray"}, function (response) {
            });
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
    function (request, sender, sendResponse) {
        console.log(sender.tab ?
        "from a content script:" + sender.tab.url :
            "from the extension");

        if (request.greeting == "init") {
            console.log("received init");

            //tabID = tabs[0].id;



            console.log(request);

            var cur_article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/

            //check nearby connections
            //get_local_holes(request.display_name);
            ingroup_connections();
            tfReturn = 0;


            chrome.storage.local.get('wiki_stack', function (data) {
                if (data.wiki_stack) {
                    wiki_stack = data.wiki_stack;
                    push_tab(cur_article_key);
                    console.log("wiki stack:");
                    console.log(wiki_stack);



                }

                chrome.storage.local.get("user_map", function (data) {
                    if (data.user_map) {
                        user_map = data.user_map;
                        if (user_map[cur_article_key]) {
                            console.log("updating user_map.last_accessed for " + cur_article_key);
                            console.log(user_map[cur_article_key].last_accessed);
                            user_map[cur_article_key].last_accessed = Date.now();
                        }
                        //tf
                        //get_local_holes();
                        //tfReturn = 0;

                        //idf
                        get_graph_holes();
                        idfReturn = 0;

                        //tf-idf

                    }

                    chrome.storage.local.set({'wiki_stack': wiki_stack, 'user_map': user_map}, function () {
                        // Notify that we saved.
                        console.log('Settings saved');

                        //resync_stack();

                        //pass data to contentscript.js
                        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                            console.log(tabs);
                            chrome.tabs.sendMessage(tabs[0].id, {
                                greeting: "init_stack",
                                wiki_stack: wiki_stack,
                                user_map: user_map
                            }, function (response) {
                            });
                        });
                    });
                });
            });
        }

        //push URL
        //if (request.greeting == "push_tab") {
        function push_tab(key) {
            console.log("received push_tab");
            var article_key = key;

            if (wiki_stack[article_key]) {
                console.log("updating wiki_stack.last_accessed for " + article_key);
                wiki_stack[article_key].last_accessed = Date.now();
            }

            console.log(wiki_stack);

            console.log(article_key);
            if (typeof(wiki_stack[article_key]) != "undefined") { //if already exists
                wiki_stack[article_key].last_accessed = Date.now();
                if (typeof(user_map[article_key]) != "undefined") {
                    user_map[article_key].last_accessed = Date.now();
                }
                //console.log(wiki_stack);
            }
            else {
                var new_item = {};
                new_item.display_name = request.display_name; //article title
                new_item.url = sender.tab.url; //actual URL of the article
                new_item.article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
                new_item.last_accessed = Date.now();
                new_item.first_added = Date.now(); //should add first_added
                console.log("saw " + new_item.article_key + " for the first time. Added new");
                console.log(new_item);
                wiki_stack[new_item.article_key] = new_item;

                //TODO: would be good to get refs in and links out
                //should be able to manually start on pages as well
                //could go off of firstHeading instead of by domain
            }

            chrome.storage.local.set({'wiki_stack': wiki_stack}, function () {
                // Notify that we saved.
                console.log('wiki_stack saved in push_tab');
                console.log('Settings saved');

                //resync_stack();
            });


            sendResponse({farewell: "goodbye"});
        }

        //}

        //push URL
        if (request.greeting == "save_tab") {
            var new_item = {};
            new_item.display_name = request.display_name; //article title
            new_item.url = sender.tab.url; //actual URL of the article
            new_item.article_key = sender.tab.url.split("/wiki/")[1]; //whatever is after /wiki/
            new_item.last_accessed = Date.now();

            last_links = request.last_links;
            console.log(last_links);

            number_returns = 0;

            if (last_links.length >= 1 && typeof(user_map[last_links[0]].display_name) != "undefined" && new_item.article_key != user_map[last_links[0]]) {
                node_distance(new_item.display_name, user_map[last_links[0]].display_name, new_item.article_key, user_map[last_links[0]].article_key);

                number_returns++;
            }
            if (last_links.length >= 2 && typeof(user_map[last_links[1]].display_name) != "undefined" && new_item.article_key != user_map[last_links[1]]) {
                node_distance(new_item.display_name, user_map[last_links[1]].display_name, new_item.article_key, user_map[last_links[1]].article_key);

                number_returns++;
            }
            if (last_links.length >= 3 && typeof(user_map[last_links[2]].display_name) != "undefined" && new_item.article_key != user_map[last_links[2]]) {
                node_distance(new_item.display_name, user_map[last_links[2]].display_name, new_item.article_key, user_map[last_links[2]].article_key);

                number_returns++;
            }


            console.log(new_item);


            user_map[new_item.article_key] = new_item;

            chrome.storage.local.set({'user_map': user_map}, function () {
                // Notify that we saved.
                console.log('Settings saved');

                resync_stack();
            });

            sendResponse({farewell: "goodbye"});
        }

        if (request.greeting == "reset_saved_data") {
            chrome.storage.local.set({"user_map": {}, "wiki_stack": {}}, resync_stack());
        }

    });

function save_and_update() {
    chrome.storage.local.set({'user_map': user_map}, function () {
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
function node_distance(nodeA, nodeB, keyA, keyB) {
    console.log("calling node_distance with " + nodeA + " " + nodeB);
    //make ajax call to local server

    //var query="MATCH (n:User) RETURN n, labels(n) as l LIMIT {limit}"
    var query = "MATCH (p0:Page {title:'" + nodeA + "'}), (p1:Page {title:'" + nodeB + "'}), p = shortestPath((p0)-[*..6]-(p1)) \r RETURN p";
    var params = {title1: nodeA, title2: nodeB};
    var cb = function (err, data) {
        console.log(JSON.stringify(data))
    }

    var postJson = {};
    var statements = {"statement": query, "parameters": params};
    postJson.statements = [statements];

    var txUrl = "http://localhost:7474/db/data/transaction/commit";

    function cypher(query, params, cb) {

        var xhr = new XMLHttpRequest();
        xhr.open("POST", txUrl, true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onreadystatechange = function (response) {
            if (xhr.readyState == 4) {
                //console.log("returned from ajax request");
                //console.log(response.target.response);
                var responseJson = JSON.parse(response.target.response);
                //console.log(responseJson);
                results_list = responseJson.results[0].data[0]["row"][0]

                results_list = count_distance(results_list);
                console.log("distance between " + nodeA + " and " + nodeB + ": " + results_list.length);
                var results_array = [];
                //send event with nodeA, nodeB, and distance between (maybe include the linkages?)

                number_returns--;
                if (number_returns == 0) {
                    save_and_update()
                }

                function count_distance(results_list) {
                    var new_results_array = []
                    for (var i = 0; i < results_list.length; i++) {
                        if (typeof(results_list[i].title) != "undefined") {
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

    function update_distance(keyA, keyB, distanceArray) {
        if (typeof(user_map[keyA].distance) == "undefined") {
            user_map[keyA].distance = {};
            user_map[keyA].distance[keyB] = distanceArray;
        }
        else {
            user_map[keyA].distance[keyB] = distanceArray;
        }

        if (typeof(user_map[keyB].distance) == "undefined") {
            user_map[keyB].distance = {};
            user_map[keyB].distance[keyA] = distanceArray.reverse();
        }
        else {
            user_map[keyB].distance[keyA] = distanceArray.reverse();
        }

        console.log(user_map);

    }

    cypher(query, params, cb);

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
function get_local_holes(curNode) {
    //if curNode is undefined, get holes for entire graph
    //else, get holes that are most closely related to current node


    //compile a list of all connections either related to current node or to the entire graph
    //get local connections
    var immediate_connections = {};
    var query_returns = 0;
    var limit_results = 100;

    var node_tree = {};
    node_tree[curNode] = {};
    console.log("node tree:");
    console.log(node_tree);

    //key: article name
    //value: sightings
    get_immediate_connections(curNode);

    //return list of all connections on a single node
    function get_immediate_connections(nodeA) {

        //BUG:
        //need to make sure strings are safe, substitute out \' for '
        //http://neo4j.com/docs/stable/cypher-expressions.html
        function replaceAll(find, replace, str) {
            return str.replace(new RegExp(find, 'g'), replace);
        }

        var inputNode = nodeA;
        replaceAll("'", "\\'", inputNode);
        //console.log(inputNode);
        inputNode.replace("'", "\\'");
        //this doesn't work.

        var query = "MATCH (p0:Page {title:'" + inputNode + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: inputNode};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    console.log("get_connections() - returned from ajax request");
                    console.log(response);

                    var responseJson = JSON.parse(response.target.response);
                    console.log(responseJson);

                    //console.log(responseJson.results[0].data[0].row[0].title);
                    for (var i = 0; i < limit_results; i++) {
                        if (typeof(responseJson.results[0].data[i]) != "undefined") {
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

                    //console.log(immediate_connections);

                    //branch out one level deep
                    var immediate_keys = Object.keys(immediate_connections);
                    for (var i = 0; i < limit_results; i++) {
                        var one_deep = immediate_keys[i];
                        //check for existence
                        if (typeof(one_deep) != "undefined") {
                            query_returns++;
                            get_connections(one_deep);

                            //console.log(one_deep);


                            node_tree[nodeA][one_deep] = [];

                        }
                    }
                    console.log(node_tree);
                    console.log("query returns - pre");
                    console.log(query_returns);
                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }

//return list of all connections on a single node
    function get_connections(nodeA) {


        var query = "MATCH (p0:Page {title:'" + nodeA + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: nodeA};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    //console.log("get_connections(" + nodeA + ") - returned from ajax request");
                    //console.log(response);

                    query_returns--;
                    console.log("query_returns - post " + query_returns);
                    if (query_returns == 0) {
                        console.log("returning compiled immediate_connections");


                        //clean up
                        //remove sightings == 1

                        var compiled_keys = Object.keys(immediate_connections);
                        //console.log(compiled_keys);
                        //console.log(compiled_keys.length);
                        for (var i = 0; i < compiled_keys.length; i++) {
                            //console.log(compiled_keys[i]);
                            //console.log(i);
                            if (typeof(compiled_keys[i]) != "undefined" && immediate_connections[compiled_keys[i]] <= 1) {
                                //console.log("deleting: "+compiled_keys[i]);
                                //delete immediate_connections[compiled_keys[i]];
                            }
                            else {
                                //console.log(immediate_connections[compiled_keys[i]]);
                                //console.log("not deleting: "+compiled_keys[i]);
                            }
                        }

                        console.log("term frequency");
                        console.log(immediate_connections); // this is TF
                        var totalTF = 0;
                        for(var i = 0; i < compiled_keys.length; i++){
                            //console.log(immediate_connections[compiled_keys[i]]);
                            totalTF += immediate_connections[compiled_keys[i]];
                        }
                        console.log(totalTF);
                        var tf = {};
                        for(var i = 0; i < compiled_keys.length; i++){
                            tf[compiled_keys[i]] = immediate_connections[compiled_keys[i]] / totalTF;
                        }
                        console.log("tf:");
                        console.log(tf);
                        tfReturn = 1;
                        globalTF = tf;
                        $(document).trigger("tfidf");

                        console.log("push recommendations -- commented out");
                        //push_recommendations(immediate_connections);

                        console.log("finished node tree:");
                        console.log(node_tree);

                        //mark recently visited
                        //mark already saved
                    }

                    var responseJson = JSON.parse(response.target.response);
                    //console.log(responseJson);

                    //console.log(responseJson.results[0].data[0].row[0].title);

                    try {
                        if (typeof(responseJson.results[0].data[0].row) != "undefined") {
                            for (var i = 0; i < limit_results; i++) {
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

                                    node_tree[Object.keys(node_tree)[0]][nodeA].push(current_sighting);
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.log(err);
                    }


                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }
}

function get_graph_holes() {
    //if curNode is undefined, get holes for entire graph
    //else, get holes that are most closely related to current node
    console.log("called get_graph_holes()");

    //compile a list of all connections either related to current node or to the entire graph
    //get local connections
    var immediate_connections = {};
    var query_returns = 0;
    var limit_results = 100;

    var node_tree = {};
    for (var i = 0; i < Object.keys(user_map).length; i++) {
        node_tree[Object.keys(user_map)[i]] = {};
        get_immediate_connections(Object.keys(user_map)[i]);
        //console.log("calling immediate connections from graph_holes(): " + Object.keys(user_map)[i]);
    }


    console.log("node tree:");
    console.log(node_tree);

    //key: article name
    //value: sightings


    //return list of all connections on a single node
    function get_immediate_connections(nodeA) {
        var query = "MATCH (p0:Page {title:'" + nodeA + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: nodeA};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    //console.log("get_connections() - returned from ajax request");
                    //console.log(response);

                    var responseJson = JSON.parse(response.target.response);
                    //console.log(responseJson);

                    //console.log(responseJson.results[0].data[0].row[0].title);
                    for (var i = 0; i < limit_results; i++) {
                        if (typeof(responseJson.results[0].data[i]) != "undefined") {
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

                    //console.log(immediate_connections);

                    //branch out one level deep
                    var immediate_keys = Object.keys(immediate_connections);
                    for (var i = 0; i < limit_results; i++) {
                        var one_deep = immediate_keys[i];
                        //check for existence
                        if (typeof(one_deep) != "undefined") {
                            query_returns++;
                            get_connections(one_deep, nodeA);

                            //console.log(one_deep);


                            node_tree[nodeA][one_deep] = [];

                        }
                    }
                    //console.log(node_tree);
                    //console.log("query returns - pre");
                    //console.log(query_returns);
                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }

//return list of all connections on a single node
    function get_connections(nodeA, parentNode) {


        var query = "MATCH (p0:Page {title:'" + nodeA + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: nodeA};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    //console.log("get_connections(" + nodeA + ") - returned from ajax request");
                    //console.log(response);

                    query_returns--;
                    //console.log("query_returns - post " + query_returns);
                    if (query_returns == 0) {
                        console.log("returning compiled immediate_connections");


                        //clean up
                        //remove sightings == 1

                        var compiled_keys = Object.keys(immediate_connections);
                        //console.log(compiled_keys);
                        //console.log(compiled_keys.length);
                        for (var i = 0; i < compiled_keys.length; i++) {
                            //console.log(compiled_keys[i]);
                            //console.log(i);
                            if (typeof(compiled_keys[i]) != "undefined" && immediate_connections[compiled_keys[i]] <= 1) {
                                //console.log("deleting: "+compiled_keys[i]);
                                delete immediate_connections[compiled_keys[i]];
                            }
                            else {
                                //console.log(immediate_connections[compiled_keys[i]]);
                                //console.log("not deleting: "+compiled_keys[i]);
                            }
                        }

                        //console.log(immediate_connections);


                        //push_recommendations(immediate_connections);

                        console.log("finished node tree:");
                        console.log(node_tree);

                        merge_node_tree();

                        function merge_node_tree() {
                            //console.log("merging node tree:");

                            merged_nodes = {};

                            oneKeys = Object.keys(node_tree);
                            for (var i = 0; i < oneKeys.length; i++) {
                                merged_nodes[oneKeys[i]] = [];
                                twoKeys = Object.keys(node_tree[oneKeys[i]]);
                                for (var j = 0; j < twoKeys.length; j++) {
                                    for (var k = 0; k < node_tree[oneKeys[i]][twoKeys[j]].length; k++) {
                                        var pathChain = [];

                                        //check ignore list, don't include path if it includes an ignored article

                                        pathChain[0] = oneKeys[i];
                                        pathChain[1] = twoKeys[j];
                                        pathChain[2] = node_tree[oneKeys[i]][twoKeys[j]][k];

                                        //if (pathChain[0] != "Bosnian language" && pathChain[1] != "Bosnian language" && pathChain[2] != "Bosnian language") {

                                            if (typeof(merged_nodes[pathChain[2]]) == "undefined") {
                                                merged_nodes[pathChain[2]] = [pathChain];
                                            }
                                            else {
                                                merged_nodes[pathChain[2]].push(pathChain);
                                            }
                                        //}
                                        //else {
                                            //console.log("ignoring: ");
                                            //console.log(pathChain);
                                        //}
                                    }
                                }
                            }
                            console.log("merged nodes:");
                            console.log(merged_nodes); //IDF
                            //need to turn this into frequency


                            console.log("sort nodes:");

                            //to sort by # of 2 level links
                            //sort the array of keys by date added

                            merged_targets = Object.keys(merged_nodes);

                            merged_targets.sort(function (a, b) {
                                //build a set for each
                                //count length
                                var setA = {};
                                for (var i = 0; i < merged_nodes[a].length; i++) {
                                    setA[merged_nodes[a][i][1]] = true;
                                }
                                var num2linksA = Object.keys(setA).length;

                                var setB = {};
                                for (var i = 0; i < merged_nodes[b].length; i++) {
                                    setB[merged_nodes[b][i][1]] = true;
                                }
                                var num2linksB = Object.keys(setB).length;

                                return num2linksB - num2linksA;
                            });

                            console.log("turn this into frequency");
                            console.log(merged_targets);

                            idf = {}; // want key: frequency
                            for(var i = 0; i < merged_targets.length; i++){ //iterate through keys
                                for(var j = 0; j < merged_nodes[merged_targets[i]].length; j++){ //iterate through array
                                    for(var k = 0; k < merged_nodes[merged_targets[i]][j].length; k++){
                                        var key = merged_nodes[merged_targets[i]][j][k];
                                        if(typeof(idf[key]) == "undefined"){
                                            idf[key] = 1;
                                        }
                                        else{
                                            idf[key] = idf[key] + 1;
                                        }
                                    }
                                }
                            }
                            console.log("inverse document frequency");
                            console.log(idf);
                            //calculate total #
                            var idfKeys = Object.keys(idf);
                            var totalIDF = 0;
                            for(var i = 0; i < idfKeys.length; i++){
                                totalIDF += idf[idfKeys[i]];
                            }
                            console.log(totalIDF);
                            for(var i = 0; i < idfKeys.length; i++){
                                idf[idfKeys[i]] = idf[idfKeys[i]] / totalIDF
                            }
                            console.log(idf);
                            idfReturn = 1;
                            globalIDF = idf;
                            $(document).trigger("tfidf");


                        }

                        //mark recently visited
                        //mark already saved
                    }

                    var responseJson = JSON.parse(response.target.response);
                    //console.log(responseJson);

                    try {
                        if (typeof(responseJson.results[0].data[0].row) != "undefined") {
                            //console.log(responseJson.results[0].data[0].row[0].title);
                            for (var i = 0; i < limit_results; i++) {

                                if (typeof(responseJson.results[0].data[i]) != "undefined" && typeof(responseJson.results[0].data[i].row) != "undefined") {
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

                                        //console.log("parentNode: "+parentNode);
                                        //console.log("nodeA: "+nodeA);
                                        node_tree[parentNode][nodeA].push(current_sighting);
                                    }
                                }


                            }
                        }
                    }
                    catch (err) {
                        console.log(err);
                        //console.log(responseJson);
                    }

                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }
}

function ingroup_connections() {
    //if curNode is undefined, get holes for entire graph
    //else, get holes that are most closely related to current node
    console.log("called ingroup_connections()");

    //compile a list of all connections either related to current node or to the entire graph
    //get local connections
    var immediate_connections = {};
    var query_returns = 0;
    var limit_results = 100;

    var node_tree = {};
    //change this to user-defined ingroup
    //if none, default to current page only

    var ingroup = {"John von Neumann":true, "Claude Shannon":true, "You have two cows":true};

    for (var i = 0; i < Object.keys(ingroup).length; i++) {
        node_tree[Object.keys(ingroup)[i]] = {};
        get_immediate_connections(Object.keys(ingroup)[i]);
        //console.log("calling immediate connections from graph_holes(): " + Object.keys(user_map)[i]);
    }


    console.log("node tree:");
    console.log(node_tree);

    //key: article name
    //value: sightings


    //return list of all connections on a single node
    function get_immediate_connections(nodeA) {
        var query = "MATCH (p0:Page {title:'" + nodeA + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: nodeA};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    //console.log("get_connections() - returned from ajax request");
                    //console.log(response);

                    var responseJson = JSON.parse(response.target.response);
                    //console.log(responseJson);

                    //console.log(responseJson.results[0].data[0].row[0].title);
                    for (var i = 0; i < limit_results; i++) {
                        if (typeof(responseJson.results[0].data[i]) != "undefined") {
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

                    //console.log(immediate_connections);

                    //branch out one level deep
                    var immediate_keys = Object.keys(immediate_connections);
                    for (var i = 0; i < limit_results; i++) {
                        var one_deep = immediate_keys[i];
                        //check for existence
                        if (typeof(one_deep) != "undefined") {
                            query_returns++;
                            get_connections(one_deep, nodeA);

                            //console.log(one_deep);


                            node_tree[nodeA][one_deep] = [];

                        }
                    }
                    //console.log(node_tree);
                    //console.log("query returns - pre");
                    //console.log(query_returns);
                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }

//return list of all connections on a single node
    function get_connections(nodeA, parentNode) {


        var query = "MATCH (p0:Page {title:'" + nodeA + "'})-[r:Link]->(results) RETURN results LIMIT " + limit_results;
        //console.log(query);
        var params = {title1: nodeA};
        var cb = function (err, data) {
            console.log(JSON.stringify(data))
        }

        var postJson = {};
        var statements = {"statement": query, "parameters": params};
        postJson.statements = [statements];

        var txUrl = "http://localhost:7474/db/data/transaction/commit";

        cypher(query, params, cb);

        function cypher(query, params, cb) {

            var xhr = new XMLHttpRequest();
            xhr.open("POST", txUrl, true);
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.onreadystatechange = function (response) {
                if (xhr.readyState == 4) {
                    //console.log("get_connections(" + nodeA + ") - returned from ajax request");
                    //console.log(response);

                    query_returns--;
                    //console.log("query_returns - post " + query_returns);
                    if (query_returns == 0) {
                        console.log("returning compiled immediate_connections");


                        //clean up
                        //remove sightings == 1

                        var compiled_keys = Object.keys(immediate_connections);
                        //console.log(compiled_keys);
                        //console.log(compiled_keys.length);
                        for (var i = 0; i < compiled_keys.length; i++) {
                            //console.log(compiled_keys[i]);
                            //console.log(i);
                            if (typeof(compiled_keys[i]) != "undefined" && immediate_connections[compiled_keys[i]] <= 1) {
                                //console.log("deleting: "+compiled_keys[i]);
                                delete immediate_connections[compiled_keys[i]];
                            }
                            else {
                                //console.log(immediate_connections[compiled_keys[i]]);
                                //console.log("not deleting: "+compiled_keys[i]);
                            }
                        }

                        //console.log(immediate_connections);


                        //push_recommendations(immediate_connections);

                        console.log("finished node tree:");
                        console.log(node_tree);

                        merge_node_tree();

                        function merge_node_tree() {
                            //console.log("merging node tree:");

                            merged_nodes = {};

                            oneKeys = Object.keys(node_tree);
                            for (var i = 0; i < oneKeys.length; i++) {
                                merged_nodes[oneKeys[i]] = [];
                                twoKeys = Object.keys(node_tree[oneKeys[i]]);
                                for (var j = 0; j < twoKeys.length; j++) {
                                    for (var k = 0; k < node_tree[oneKeys[i]][twoKeys[j]].length; k++) {
                                        var pathChain = [];

                                        //check ignore list, don't include path if it includes an ignored article

                                        pathChain[0] = oneKeys[i];
                                        pathChain[1] = twoKeys[j];
                                        pathChain[2] = node_tree[oneKeys[i]][twoKeys[j]][k];

                                        //if (pathChain[0] != "Bosnian language" && pathChain[1] != "Bosnian language" && pathChain[2] != "Bosnian language") {

                                        if (typeof(merged_nodes[pathChain[2]]) == "undefined") {
                                            merged_nodes[pathChain[2]] = [pathChain];
                                        }
                                        else {
                                            merged_nodes[pathChain[2]].push(pathChain);
                                        }
                                        //}
                                        //else {
                                        //console.log("ignoring: ");
                                        //console.log(pathChain);
                                        //}
                                    }
                                }
                            }
                            console.log("merged nodes:");
                            console.log(merged_nodes); //IDF
                            //need to turn this into frequency


                            console.log("sort nodes:");

                            //to sort by # of 2 level links
                            //sort the array of keys by date added

                            merged_targets = Object.keys(merged_nodes);

                            merged_targets.sort(function (a, b) {
                                //build a set for each
                                //count length
                                var setA = {};
                                for (var i = 0; i < merged_nodes[a].length; i++) {
                                    setA[merged_nodes[a][i][1]] = true;
                                }
                                var num2linksA = Object.keys(setA).length;

                                var setB = {};
                                for (var i = 0; i < merged_nodes[b].length; i++) {
                                    setB[merged_nodes[b][i][1]] = true;
                                }
                                var num2linksB = Object.keys(setB).length;

                                return num2linksB - num2linksA;
                            });

                            console.log("turn this into frequency");
                            console.log(merged_targets);

                            var tf = {}; // want key: frequency
                            for(var i = 0; i < merged_targets.length; i++){ //iterate through keys
                                for(var j = 0; j < merged_nodes[merged_targets[i]].length; j++){ //iterate through array
                                    for(var k = 0; k < merged_nodes[merged_targets[i]][j].length; k++){
                                        var key = merged_nodes[merged_targets[i]][j][k];
                                        if(typeof(tf[key]) == "undefined"){
                                            tf[key] = 1;
                                        }
                                        else{
                                            tf[key] = tf[key] + 1;
                                        }
                                    }
                                }
                            }
                            console.log("ingroup term frequency");
                            console.log(tf);
                            //calculate total #
                            var tfKeys = Object.keys(tf);
                            var totalTF = 0;
                            for(var i = 0; i < tfKeys.length; i++){
                                totalTF += tf[tfKeys[i]];
                            }
                            console.log(totalTF);
                            for(var i = 0; i < tfKeys.length; i++){
                                tf[tfKeys[i]] = tf[tfKeys[i]] / totalTF
                            }
                            console.log(tf);
                            tfReturn = 1;
                            globalTF = tf;
                            $(document).trigger("tfidf");


                        }

                        //mark recently visited
                        //mark already saved
                    }

                    var responseJson = JSON.parse(response.target.response);
                    //console.log(responseJson);

                    try {
                        if (typeof(responseJson.results[0].data[0].row) != "undefined") {
                            //console.log(responseJson.results[0].data[0].row[0].title);
                            for (var i = 0; i < limit_results; i++) {

                                if (typeof(responseJson.results[0].data[i]) != "undefined" && typeof(responseJson.results[0].data[i].row) != "undefined") {
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

                                        //console.log("parentNode: "+parentNode);
                                        //console.log("nodeA: "+nodeA);
                                        node_tree[parentNode][nodeA].push(current_sighting);
                                    }
                                }


                            }
                        }
                    }
                    catch (err) {
                        console.log(err);
                        //console.log(responseJson);
                    }

                }
            };
            xhr.send(JSON.stringify(postJson));

        }
    }
}


function push_recommendations(recommendations) {
    //pass data to contentscript.js
    console.log("push recommendations");
    console.log(recommendations);

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            greeting: "push_recommendations",
            recommendations: recommendations
        }, function (response) {
        });
    });
}


//do tf-idf
//push recommendations
$(document).on("tfidf", function(){
    //console.log("tfidf listener triggered");
    //console.log("tfReturn = " + tfReturn);
    //console.log("idfReturn = "+idfReturn);
    if(tfReturn == 1 && idfReturn == 1){
        console.log("tfidf listener - both true");

        //create tfidf by dividing all items in tf array by corresponding idf

        console.log(globalTF);
        console.log(globalIDF);

        var tfKeys = Object.keys(globalTF);
        for(var i = 0; i < tfKeys.length; i++){
            try{
                //console.log("globalTF : "+globalTF[tfKeys[i]]);
                //console.log("globalIDF : "+globalIDF[tfKeys[i]]);
                if(typeof(globalIDF[tfKeys[i]]) != "undefined"){
                    globalTFIDF[tfKeys[i]] = globalTF[tfKeys[i]] / globalIDF[tfKeys[i]];
                }
                else{
                    //this is totally hacky - solution for when IDF is undefined
                    globalTFIDF[tfKeys[i]] = globalTF[tfKeys[i]] / .00005;
                }

                //console.log("globalTFIDF : "+globalTFIDF[tfKeys[i]]);
            }
            catch(err){
                console.log(err);
                console.log(tfKeys[i]);
            }
        }
        console.log("globalTFIDF:");
        console.log(globalTFIDF);

        console.log(tfKeys);

        //this gets taken care of in the contentscript.js
        //sort the array of keys by tfidf
        //tfKeys.sort(function (a, b) {
        //    //console.log(globalTFIDF[a]);
        //    //console.log(globalTFIDF[b]);
        //    //console.log(globalTFIDF[a] - globalTFIDF[b]);
        //
        //
        //    return (globalTFIDF[b] - globalTFIDF[a]);
        //});
        ////tfidfKeys = tfKeys;
        //
        //console.log(tfKeys);

        var tfidfRecs = {};
        for(var i = 0; i < tfKeys.length;i++){
            //console.log(tfKeys[i]);
            //console.log(globalTFIDF[tfKeys[i]]);
            tfidfRecs[tfKeys[i]] = globalTFIDF[tfKeys[i]];
        }
        push_recommendations(tfidfRecs);

        //sort array
        //push recommendations

    }
});