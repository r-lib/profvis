HTMLWidgets.widget({

  name: 'profvis',

  type: 'output',

  initialize: function(el, width, height) {

    return {
      // TODO: add instance fields as required
    };

  },

  renderValue: function(el, x, instance) {
    var prof = profvis.colToRows(x.message.prof);
    var allFileTimes = profvis.getLineTimes(prof, x.message.files);

    var content = '<table class="profvis-table">';
    for (i=0; i < allFileTimes.length; i++) {
      var fileData = allFileTimes[i];

      content += '<tr><th>' + fileData.filename + '</th><th></th></tr>';

      for (j=0; j<fileData.lineData.length; j++) {
        var line = fileData.lineData[j];
        content += "<tr>" +
          '<td class="code"><pre><code>' + line.content + '</code></pre></td>' +
          '<td class="time">' + (Math.round(line.time * 100) / 100) + '</td>' +
          '</tr>';
      }
    }
    content += "</table>";

    el.innerHTML = content;
  },

  resize: function(el, width, height, instance) {

  }

});
