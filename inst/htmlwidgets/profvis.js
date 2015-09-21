HTMLWidgets.widget({

  name: 'profvis',

  type: 'output',

  initialize: function(el, width, height) {

    return {
      // TODO: add instance fields as required
    };

  },

  renderValue: function(el, x, instance) {
    var table = document.createElement("div");
    table.className = "profvis-code";
    el.appendChild(table);
    profvis.generateTable(table, x.message);

    var flameGraph = document.createElement("div");
    flameGraph.className = "profvis-flamegraph";
    el.appendChild(flameGraph);
    profvis.generateFlameGraph(flameGraph, x.message);
  },

  resize: function(el, width, height, instance) {

  }

});
