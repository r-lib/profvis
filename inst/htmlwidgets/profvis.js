HTMLWidgets.widget({

  name: 'profvis',

  type: 'output',

  initialize: function(el, width, height) {

    return {
      // TODO: add instance fields as required
    };

  },

  renderValue: function(el, x, instance) {

    files = x.message.files;

    var content = '<table class="profvis-table">';
    for (i=0; i<files.length; i++) {
      var lines = files[i].content.split("\n");

      for (j=0; j<lines.length; j++) {
        content += "<tr><td><pre><code>" + lines[j] + "</code></pre></td></tr>";
      }
    }
    content += "</table>";

    el.innerHTML = content;

  },

  resize: function(el, width, height, instance) {

  }

});
