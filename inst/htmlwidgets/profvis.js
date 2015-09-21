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
    el.appendChild(table);
    profvis.generateTable(table, x.message);

    var flameGraph = document.createElement("div");
    el.appendChild(flameGraph);
    profvis.generateFlameGraph(el, x.message);
  },

  resize: function(el, width, height, instance) {

  }

});
