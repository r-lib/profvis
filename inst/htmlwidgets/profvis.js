HTMLWidgets.widget({

  name: 'profvis',

  type: 'output',

  initialize: function(el, width, height) {

    return {
      // TODO: add instance fields as required
    };

  },

  renderValue: function(el, x, instance) {
    var content = profvis.generateHTMLtable(x.message);

    el.innerHTML = content;
  },

  resize: function(el, width, height, instance) {

  }

});
