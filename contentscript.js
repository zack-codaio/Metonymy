/**
 * Created by zackaman on 4/2/15.
 */
var user_map;

$(document).ready(function () {
    window.tray_opened = false;
    var historical_view = false;

    var historical_stack;
    var saved_stack;

    var display_name = $("#firstHeading").text();
    var last_links = [];


    open_tray();
    init_stack();
    push_tab();

    function open_tray() {
        $('body').css({
            //"transition":"margin-right .5s",
            "margin-right": "300px"
        });
        $('#mw-head').css({
            //"transition":"margin-right .5s",
            "margin-right": "300px"
        });
        //append 400px sidebar to the right, positioned absolute

        $('body').append("<div id='rh_sidebar'>test1</div>");
        setTimeout(function () {
            $('#rh_sidebar').css({"right": "0px"});
        }, 0);

        //chrome.extension.sendRequest({cmd: "read_file"}, function(html){
        //    $("#rh_sidebar").html(html);
        //});

        $('#rh_sidebar').load(chrome.extension.getURL("tray.html"), function () {
            init();
        });
        window.tray_opened = true;
    }

    function init_stack() {
        console.log("called init_stack");
        chrome.runtime.sendMessage({greeting: "init", display_name: display_name}, function (response) {
            console.log("received init response");
            console.log(response.farewell);
        });
    }

    function push_tab() {
        chrome.runtime.sendMessage({greeting: "push_tab", display_name: display_name}, function (response) {
            console.log("received push tab response");
            console.log(response.farewell);
        })
    }

    function save_tab() {
        chrome.runtime.sendMessage({
            greeting: "save_tab",
            display_name: display_name,
            last_links: last_links
        }, function (response) {
            console.log("received save tab response");
            console.log(response.farewell);
            //add stack of last_links (sorted)
        })
    }

    function reset_saved_data() {
        chrome.runtime.sendMessage({greeting: "reset_saved_data"}, function (response) {
            console.log("received reset_saved_data response");
            console.log(response.farewell);
        })
    }

    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {

            //deprecated
            if (request.greeting == "open_tray" && window.tray_opened == false) {
                console.log("received extension started");
                $('body').css({"transition": "margin-right .5s", "margin-right": "400px"});
                $('#mw-head').css({"transition": "margin-right .5s", "margin-right": "400px"});
                //append 400px sidebar to the right, positioned absolute

                $('body').append("<div id='rh_sidebar'>test1</div>");
                setTimeout(function () {
                    $('#rh_sidebar').css({"right": "0px"});
                }, 0);

                $('#rh_sidebar').load(chrome.extension.getURL("tray.html"));
            }


            if (request.greeting == "close_tray" && window.tray_opened == true) {
                $('body').css({"margin-right": "0"});
                $('#mw-head').css({"margin-right": "0"});
            }

            if (request.greeting == "push_recommendations"){
                console.log("received push_recommendations");
                var recommendations = request.recommendations;
                console.log(recommendations);
                var rec_keys = Object.keys(recommendations);

                //to sort by most recommended
                //sort the array of keys by number of sightings
                rec_keys.sort(function (a, b) {
                    //console.log(recommendations[a]);
                    //console.log(recommendations[b]);
                    //console.log(recommendations[rec_keys[a]] - recommendations[rec_keys[b]]);
                    return (recommendations[b] - recommendations[a]);
                });
                console.log(recommendations);
                console.log(rec_keys);


                var links_container = $("#recommendations");
                links_container.html("<p>Recommendations</p>");
                for (var i = 0; i < rec_keys.length; i++) {

                    // /w/index.php?search=Barack+Obama%2C+Sr.&title=Special%3ASearch
                    var rec_link = '/w/index.php?search='+rec_keys[i]+'&title=Special%3ASearch';
                    links_container.append("<a href=" + rec_link + "><div class='saved_link'>" + rec_keys[i] + " "+recommendations[rec_keys[i]] +"</div></a>");
                }



            }

            //sync stack
            if (request.greeting == "resync_stack" || request.greeting == "init_stack") {
                console.log("received resync stack command");
                console.log("history object:");
                console.log(request.wiki_stack);
                console.log("user saved pages:");
                console.log(request.user_map);

                user_map = request.user_map;

                historical_stack = request.wiki_stack;
                saved_stack = request.user_map;

                var saved_links = Object.keys(request.user_map);
                //console.log(saved_links);

                //to sort by date added
                //sort the array of keys by date added
                saved_links.sort(function (a, b) {
                    //console.log(request.user_map[b].display_name + " "+request.user_map[a].display_name);
                    //console.log(request.user_map[b].last_accessed - request.user_map[a].last_accessed);
                    return (request.user_map[b].last_accessed - request.user_map[a].last_accessed);
                });
                last_links = saved_links;
                console.log(last_links);


                var links_container = $("#saved_links");
                links_container.html("<p>Saved Links</p>");
                for (var i = 0; i < saved_links.length; i++) {
                    links_container.append("<a href=" + request.user_map[saved_links[i]].url + "><div class='saved_link'>" + request.user_map[saved_links[i]].display_name + "</div></a>");
                }

                draw_graph();
            }
        });


    function init() {
        $("#save_page_button").click(function (e) {
            console.log("save current page to user_map");
            push_tab();
            save_tab();
        });

        $("#reset_state_button").click(function (e) {
            console.log("resetting state");
            reset_saved_data();
        });

        $("#node_button").click(function (e) {
            console.log("toggling node graph");
            $(".force_container").toggle();
        });


        $("#history_button").click(function (e) {
            console.log("toggling history view");
            historical_view = !historical_view;
            if (historical_view) {
                var saved_links = Object.keys(historical_stack);
                //console.log(saved_links);
                var links_container = $("#saved_links");
                links_container.html("");
                for (var i = 0; i < saved_links.length; i++) {
                    links_container.append("<a href=" + historical_stack[saved_links[i]].url + "><div class='saved_link'>" + historical_stack[saved_links[i]].display_name + "</div></a>");
                }
            }
            else {
                var saved_links = Object.keys(saved_stack);
                //console.log(saved_links);
                var links_container = $("#saved_links");
                links_container.html("");
                for (var i = 0; i < saved_links.length; i++) {
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

        $(".force_container").toggle();



    }


    function draw_graph() {
        var my_nodes = {
            "nodes": [
                {"x": 469, "y": 410},
                {"x": 493, "y": 364},
                {"x": 442, "y": 365},
                {"x": 467, "y": 314},
                {"x": 477, "y": 248},
                {"x": 425, "y": 207},
                {"x": 402, "y": 155},
                {"x": 369, "y": 196},
                {"x": 350, "y": 148},
                {"x": 539, "y": 222},
                {"x": 594, "y": 235},
                {"x": 582, "y": 185},
                {"x": 633, "y": 200}
            ],
            "links": [
                {"source": 0, "target": 1},
                {"source": 1, "target": 2},
                {"source": 2, "target": 0},
                {"source": 1, "target": 3},
                {"source": 3, "target": 2},
                {"source": 3, "target": 4},
                {"source": 4, "target": 5},
                {"source": 5, "target": 6},
                {"source": 5, "target": 7},
                {"source": 6, "target": 7},
                {"source": 6, "target": 8},
                {"source": 7, "target": 8},
                {"source": 9, "target": 4},
                {"source": 9, "target": 11},
                {"source": 9, "target": 10},
                {"source": 10, "target": 11},
                {"source": 11, "target": 12},
                {"source": 12, "target": 10}
            ]
        };


        set_nodes();
        console.log("set_nodes()");
        function set_nodes() {
            my_nodes = {"nodes": [], "links": []};
            var objKeys = Object.keys(user_map);
            console.log(objKeys);

            //push all nodes with index and name
            for (var i = 0; i < objKeys.length; i++) {
                //assign index
                var new_node = {};
                new_node.index = i;
                new_node.name = objKeys[i];
                //push
                my_nodes.nodes.push(new_node);
            }

            //build links between nodes
            for (var i = 0; i < objKeys.length; i++) {
                //look at distance for each item in user_map
                //try building redundant ones first but build logic to check for redundancy if it doesn't work
                console.log(user_map[objKeys[i]].distance);
                if (typeof(user_map[objKeys[i]].distance) != "undefined" && Object.keys(user_map[objKeys[i]].distance).length > 0) {
                    var distances = Object.keys(user_map[objKeys[i]].distance);
                    for (var j = 0; j < distances.length; j++) {
                        //push a link
                        new_link = {};

                        new_link.source = objKeys[i];
                        new_link.target = distances[j];
                        if(typeof(user_map[objKeys[i]].distance[distances[j]]) != "undefined") {
                            new_link.weight = user_map[objKeys[i]].distance[distances[j]].length;
                        }
                        my_nodes.links.push(new_link);
                    }
                }
            }

            console.log(my_nodes);
        }


        var width = 960,
            height = 500;

        var force = d3.layout.force()
            .size([width, height])
            .charge(-400)
            .linkDistance(40)
            .on("tick", tick);

        var drag = force.drag()
            .on("dragstart", dragstart);

        var svg = d3.select(".force_container").append("svg")
            .attr("width", width)
            .attr("height", height);

        var link = svg.selectAll(".link"),
            node = svg.selectAll(".node");

        force
            .nodes(my_nodes.nodes)
            .links(my_nodes.links)
            .start();

        link = link.data(my_nodes.links)
            .enter().append("line")
            .attr("class", "link");

        node = node.data(my_nodes.nodes)
            .enter().append("circle")
            .attr("class", "node")
            .attr("r", 12)
            .on("dblclick", dblclick)
            .call(drag);
        console.log("passed force link node");

        function tick() {
            link.attr("x1", function (d) {
                return d.source.x;
            })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

            node.attr("cx", function (d) {
                return d.x;
            })
                .attr("cy", function (d) {
                    return d.y;
                });
        }

        function dblclick(d) {
            d3.select(this).classed("fixed", d.fixed = false);
        }

        function dragstart(d) {
            d3.select(this).classed("fixed", d.fixed = true);
        }

    }
});