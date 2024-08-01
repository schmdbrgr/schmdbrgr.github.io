var handleData = d3.json("jama_tree.json").then(data => 
{
    const stratify = d3.stratify()
        .id(d => d['item_uid'])
        .parentId(d => d['parent_uid']);

    const root = stratify(data).sort((a, b) => {
        var a_substrs = a.data.document_key.split("-");
        var b_substrs = b.data.document_key.split("-");
        if (a_substrs[1].charCodeAt(0) != b_substrs[1].charCodeAt(0))
            return a_substrs[1].charCodeAt(0) - b_substrs[1].charCodeAt(0);
        a_substrs = a.data.heading.split(".");
        b_substrs = b.data.heading.split(".");
        return parseInt(a_substrs.reverse()[0]) - parseInt(b_substrs.reverse()[0]);
    });
    layout_tree(root);
});

function addSVGDefs(svg) {
    var defs = svg.append("defs");

    defs.append("marker")
        .attr("id", "blackarrowhead")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 5)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z");

    defs.append("marker")
        .attr("id", "whitearrowhead")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 5)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", "white")
        .attr("stroke", "black");
}

function layout_tree(root_node) {
    const width = 1280;
    const height = 1080;
    const margin = {left: 5, top: 8, right: 5, bottom: 20};
    const parser = new DOMParser();
    const node_height = 100;
    const node_width = 225;
    const open_goal_color = "#ae1f33";
    const open_str_color = "#087a93";
    const collapse_color = "#bdb5ac";
    var node_map = {};
    var true_root = root_node;
    
    var zoomListener = d3.zoom().scaleExtent([0.1, 2])
        .on("zoom", function (event) {
            top_g.attr("transform", event.transform);
        });
    
    var svg = d3.select("#graphContainer")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .call(d3.zoom().translateBy, window.innerWidth / 2, 50)
        .call(zoomListener);

    addSVGDefs(svg);

    var reset_button = d3.select("#graphContainer")
        .append("button")
        .classed("hidden", true)
        .attr("id", "resetBtn")
        .attr("title", "Go to top claim")
        .text("Go to top claim")
        .on("click", (e) => {
            root_node = true_root;
            draw_tree(true_root);
            d3.select("#resetBtn").classed("hidden", true);
            console.log("redrawing");
        });
    
    var top_g = svg.append("g").attr("transform", "translate (" + window.innerWidth / 2 + ",50)");

    var i = 0;
    var duration = 750;

    var leafs = ["SOLUTION", "INDICATOR"];

    var get_separation = function(a, b) {
        if (leafs.includes(a.data.item_type) && leafs.includes(b.data.item_type)) return 0.55;
        else if (a.parent == b.parent) {
            if (leafs.includes(a.data.item_type) || leafs.includes(b.data.item_type)) return 0.75;
            else return 1.05;
        }
        else return 1.1;
    };

    var d3_tree = d3.tree()
        .nodeSize([node_width, node_height])
        .separation((a, b) => get_separation(a,b));
    
    root_node.x0 = 0;
    root_node.y0 = width / 3;
    root_node.collapse = false;

    root_node.children.forEach(collapse);

    var diagonal = d3.linkVertical();

    draw_tree(root_node);

    function enterNodes(source, boundSelection) {
        var nodeEnter = boundSelection.enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                return "translate(" + source.x0 + "," + source.y0 + ")";
            })
            .on("click", handleNodeClick);

        // Add goal rectangles
        nodeEnter.filter(d => d.data.item_type == "GOAL")
            .append("rect")
            .attr("class", "goal")
            .attr('x', -node_width/2)
            .attr('y', -node_height/2)
            .attr('width', node_width)
            .attr('height', node_height)
            .attr('stroke', 'black')
            .attr('fill', function(d) {
                return d.data.children_uids.length ? collapse_color : open_goal_color;
            })
            .on("auxclick", handleRootNodeChange);

        // Add context rounded rectangles
        nodeEnter.filter(d => d.data.item_type == "CONTEXT")
            .append("rect")
            .attr("class", "context")
            .attr('x', -node_width/2)
            .attr('y', -node_height/2)
            .attr('width', node_width)
            .attr('height', node_height)
            .attr('rx', node_height/2)
            .attr('ry', node_height/2)
            .attr('stroke', 'black')
            .attr('fill', "#f5f2f2");
        
        // Add strategy parallelograms
        nodeEnter.filter(d => d.data.item_type == "STRATEGY")
            .append("polygon")
            .attr("class", "str")
            .attr("points", "-75,-50 125,-50 75,50 -125,50")
            .attr('stroke', 'black')
            .attr('fill', function(d) {
                return d.data.children_uids.length ? collapse_color : open_str_color;
            });
        
        // Add solution circles
        nodeEnter.filter(d => d.data.item_type == "SOLUTION")
            .append("circle")
            .attr("class", "sol")
            .attr("cy", 0)
            .attr("r", 50)
            .attr('stroke', 'black');

        // Add assumptions and justifications ellipses
        nodeEnter.filter(d => d.data.item_type == "ASSUMPTION" || d.data.item_type == "JUSTIFICATION")
            .append("ellipse")
            .attr("class", "just")
            .attr('rx', node_width/2)
            .attr('ry', node_height/2)
            .attr('stroke', 'black')
            .attr('fill', "#f5f2f2");

        // Add Performance Indicators
        nodeEnter.filter(d => d.data.item_type == "INDICATOR")
            .append("polygon")
            .attr("class", "kpi")
            .attr("points", "0,-50 50,0 0,50 -50,0")
            .attr('stroke', 'black');;
        
        // Add A "label"
        nodeEnter.filter(d => d.data.item_type == "ASSUMPTION")
            .append("text")
            .attr("class", "gsnid")
            .text("A")
            .attr("x", 115)
            .attr("y", 47);

        // Add J "label"
        nodeEnter.filter(d => d.data.item_type == "JUSTIFICATION")
            .append("text")
            .attr("class", "gsnid")
            .text("J")
            .attr("x", 115)
            .attr("y", 47);

        // Add expand icon
        nodeEnter.filter(function(d) {
                if (d.data.children_uids.length && (d.data.item_type == "STRATEGY" || d.data.item_type == "GOAL"))
                    return true;
            })
            .append("circle")
            .attr("class", "expand")
            .attr("r", 6)
            .attr("cy", node_height/2)
            .attr("stroke", "black")
            .style("fill", "white");
        
        nodeEnter.filter(function(d) {
                if (d.data.children_uids.length && (d.data.item_type == "STRATEGY" || d.data.item_type == "GOAL"))
                    return true;
            })
            .append("path")
            .attr("class", "symbol")
            .attr("d", d3.symbol(d3.symbolPlus, 32))
            .attr("transform", "translate(0," + node_height/2 + ")")
            .attr("stroke", d => d.collapse ? "black" : "white")
            .attr("stroke-width", 1.5);

        // Add undeveloped goal diamond
        nodeEnter.filter(function(d) {
                if (d.data.item_type == "GOAL" && d.data.children_uids.length == 0)
                    return true;
            })
            .append("polygon")
            .attr("class", "undeveloped")
            .attr("points", "0," + node_height/2 + " 6," + (node_height/2 + 6) + " 0," + (node_height/2 + 12) + " -6," + (node_height/2 + 6))
            .attr("stroke", "black")
            .style("fill", "white");
        
        // Add GSN identifier
        nodeEnter.append("text")
           .attr("class", "gsnid")
           .attr("y", d => d.data.item_type == "INDICATOR" ? -30 : -node_height/2 + margin.top)
           .attr("x", function(d) {
              if      (d.data.item_type == "STRATEGY") return -77;
              else if (d.data.item_type == "SOLUTION") return -15;
              else if (d.data.item_type == "INDICATOR") return -15;
              else if (d.data.item_type == "CONTEXT") return -node_width / 3;
              else if (d.data.item_type == "ASSUMPTION" || d.data.item_type == "JUSTIFICATION") return -15;
              else return -node_width / 2 + margin.left;
           })
           .attr("dy", ".35em")
           .attr("text-anchor", "start")
           .text(d => {
                if (d.data.item_type == "GOAL") {
                   if (d.data.heading.length < 6) return "G0"; //was length < 4
                   else return "G" + d.data.heading.slice(6); //was .slice(4)
                }
                var substrs = d.data.document_key.split("-");
                return substrs[1] + substrs[2];
           })
           .style("fill-opacity", 1e-6);
        
        // Add GSN statement
        nodeEnter.append("text")
           .attr("class", "statement")
           .attr("x", function(d) {
              if      (d.data.item_type == "STRATEGY") return -80;
              else if (leafs.includes(d.data.item_type)) return 0;
              else if (d.data.item_type == "CONTEXT") return -98;
              else if (d.data.item_type == "ASSUMPTION" || d.data.item_type == "JUSTIFICATION") return -80;
              else return -node_width / 2 + margin.left;
           })
           .attr("dy", d => d.data.item_type == "INDICATOR" ? "0.15em" :  d.data.item_type == "SOLUTION" ? "-1.0em" : "-1.5em")
           .attr("text-anchor", d => leafs.includes(d.data.item_type) ? "middle" :  "start")
           .text(d => {
                // const use_desc = ["STRATEGY", "CONTEXT", "ASSUMPTION", "JUSTIFICATION"]
                const use_desc = ["STRATEGY", "ASSUMPTION", "JUSTIFICATION"]
                // if (d.data.item_type == "GOAL") return d.data.name.split(" ").slice(1).join(" ");
                if (!use_desc.includes(d.data.item_type)) return d.data.name;
                var doc = parser.parseFromString(d.data.description, "text/html");
                if (doc.getElementsByTagName("p").length < 1) return d.data.description;
                return doc.getElementsByTagName("p")[0].textContent;

           })
           .call(wrapSVGText, margin);

        return nodeEnter;
    }

    function map_node(d) {
        node_map[d.id] = d;
        if (d.children) d.children.forEach(map_node);
        if (d._children) d._children.forEach(map_node);
    }

    function draw_tree(source) {
        var treeData = d3_tree(root_node);
        var nodes = treeData.descendants(),
            links = treeData.descendants().slice(1);

        nodes.forEach(function(d) { d.y = d.depth * 180;});
        nodes.forEach(map_node);
       
        var node = top_g.selectAll("g.node")
            .data(nodes, function(d) {
                if (d.parent) return d.parent.id + "-" + d.id;
                return d.id || (d.id == ++i);
            });

        var nodeEnterSelection = enterNodes(source, node);

        var nodeUpdate = nodeEnterSelection.merge(node);
        
        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")"; 
            });

        nodeUpdate.select("rect.goal")
            .classed("open", d => !d.collapse)
            .attr("fill", function(d) {
                return d.collapse ? collapse_color : open_goal_color;
            })
            .attr("cursor", "pointer");

        nodeUpdate.select("polygon.str")
            .classed("open", d => !d.collapse)
            .attr("fill", function(d) {
                return d.collapse ? collapse_color : open_str_color;
            })
            .attr("cursor", "pointer");

        nodeUpdate.select("path.symbol")
            .attr("stroke", d => d.collapse ? "black" : "white");
        
        nodeUpdate.selectAll("text")
            .classed("open", d => !d.collapse)
            .style("fill-opacity", 1);

        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + source.x + "," + source.y + ")"; 
            })
            .remove();
        
        nodeExit.select("circle").attr("r", 1e-6);
        nodeExit.selectAll("text").style("fill-opacity", 1e-6);

        var link = top_g.selectAll("path.link")
            .data(links, function(d) {
                return d.id + "-" + d.parent.id;
            });
        
        const MARKER_PADDING = 5;
        var linkEnter = link.enter()
            .insert("path", "g")
            .attr("class", "link")
            .attr("d", diagonal({source: [source.x0, source.y0-node_height/2-MARKER_PADDING], target: [source.x0, source.y0+node_height/2]}));

        var linkUpdate = linkEnter.merge(link);
        
        linkUpdate.transition()
            .duration(duration)
            .attr("d", d => diagonal({source: [d.x, d.y-node_height/2-MARKER_PADDING], target: [d.parent.x, d.parent.y+node_height/2]}))
            .attr("marker-start", function(d) {
                if (d.data.item_type == "GOAL" ||
                    d.data.item_type == "STRATEGY" ||
                    d.data.item_type == "SOLUTION")
                    return "url(#blackarrowhead)";
                return "url(#whitearrowhead)";
            });

        var linkExit = link.exit().transition()
            .duration(duration)
            .attr("d", diagonal({source: [source.x, source.y-node_height/2-MARKER_PADDING], target: [source.x, source.y+node_height/2]}))
            .remove();
        
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function wrapSVGText(text, margin) {

        x_pos = function (item_type, topX, lineNo) {

            if (item_type == "STRATEGY") {
                return topX - 7 * lineNo;
            }
            else if (item_type == "ASSUMPTION" || item_type == "JUSTIFICATION") {
                if (lineNo == 1)      return topX - 25;
                else if (lineNo == 2) return topX - 30;
                else if (lineNo == 3) return topX - 20;
                else if (lineNo == 4) return topX - (-10);
                return topX;
            }
            else if (item_type == "CONTEXT") {
                if (lineNo % 2 == 1)  return topX - 8;
                else if (lineNo == 2) return topX - 10;
                else                  return topX;
            }
            else {
                return topX;
            }
        };

        text.each(function(d) {
            var width;
            if      (d.data.item_type == "SOLUTION") width = 95;
            else if (d.data.item_type == "STRATEGY") width = 180;
            else if (d.data.item_type == "CONTEXT") width = 200;
            else if (d.data.item_type == "ASSUMPTION" || d.data.item_type == "JUSTIFICATION") width = 180;
            else if (d.data.item_type == "INDICATOR") width = 100;
            else width = node_width - margin.left - margin.right;
            var word;
            var text = d3.select(this);
            var words = text.text().split(/\s+/).reverse();
            var line = [];
            var lineNo = 1;
            var topX = text.attr("x");
            var topY = text.attr("y");
            var topDY = parseFloat(text.attr("dy"));
            var tspan = text.text(null)
                .append("tspan")
                .attr("x", topX)
                .attr("y", topY)
                .attr("dy", topDY + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    if (lineNo >= 5) line.push("...");
                    tspan.text(line.join(" "));
                    if (lineNo >= 5) break;
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", d => x_pos(d.data.item_type, topX, lineNo))
                        .attr("y", topY)
                        .attr("dy", "1em")
                        .text(word);
                    lineNo++;
                }
            }
        })
    }

    function collapse(d) {
        if (d.children) {
            d.collapse = true;
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
        else if (d.data.children_uids.length) {
            d.collapse = true;
        }
    }

    function handleNodeClick(event, d) {
        console.log("handleNodeClick on...");
        console.log(d);
        if (d.children) {
            d._children = d.children;
            d.children = null;
            d.collapse = true;
        }
        else {
            if (d.data.children_uids.length && (!d._children || d.data.children_uids.length != d._children.length)) {
                var new_kids = [];
                d.data.children_uids.forEach(uid => {
                    var child = new Object();
                    child = {
                        ...node_map[uid.toString()],
                        parent: d,
                        depth: d.depth + 1
                    };
                    if (child.parent.collapse) new_kids.push(child); // Don't add extra child if its parent already has it down
                });
                if (!d._children) d._children = new_kids;
                else {
                    var old_kids = d._children.map(k => k.id);
                    new_kids.forEach(k => {
                        if (!old_kids.includes(k.id)) d._children.push(k);
                    })
                }
            }
            
            d.children = d._children;           
            d._children = null;
            d.collapse = false;
        }        
        draw_tree(d);
    }

    function handleRootNodeChange(event, d) {
        if (d.id == true_root.id) return;
        reset_button.classed("hidden", false);
        root_node = d;
        draw_tree(root_node);
    }

};
