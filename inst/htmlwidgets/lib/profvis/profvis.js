/*jshint
  undef:true,
  browser:true,
  devel: true,
  jquery:true,
  strict:false,
  curly:false,
  indent:2
*/
/*global profvis:true, _ */

profvis = (function() {
  var profvis = {};

  profvis.generateHTMLtable = function(message) {
    var prof = colToRows(message.prof);
    var allFileTimes = getLineTimes(prof, message.files);

    var content = '<table class="profvis-table">';
    for (var i=0; i < allFileTimes.length; i++) {
      var fileData = allFileTimes[i];

      content += '<tr><th>' + fileData.filename + '</th><th></th></tr>';

      for (var j=0; j<fileData.lineData.length; j++) {
        var line = fileData.lineData[j];
        content += "<tr>" +
          '<td class="code"><pre><code>' + escapeHTML(line.content) + '</code></pre></td>' +
          '<td class="time">' + (Math.round(line.time * 100) / 100) + '</td>' +
          '<td class="timebar">' +
            '<div style="width: ' + Math.round(line.propTime * 100) + '%; background-color: black;">&nbsp;</div>' +
          '</td>' +
          '</tr>';
      }
    }
    content += "</table>";

    return content;
  };

  function getLineTimes(prof, files) {
    // Calculate times for each file
    var times = _.map(files, function(file) {
      var data = simplifyRef(prof, file.filename);

      data = collapseByLineId(data);

      // Sum up times for each line id group
      _.map(data, function(group) {
        // Calculate the time for each group
        var time = _.reduce(group.value, function(total, x) {
          return total + x.time;
        }, 0);

        group.time = time;
      });

      // Create array of objects with info for each line of code.
      var lines = file.content.split("\n");
      var lineData = [];
      for (var i=0; i<lines.length; i ++) {
        lineData[i] = {
          filename: file.filename,
          lineNum: i + 1,
          content: lines[i],
          time: 0
        };
      }

      // Copy times from `data` to `lineData`.
      _.map(data, function(lineTime) {
        var lineNum = lineTime.lineNum - 1;
        lineData[lineNum].time = lineTime.time;
      });

      return {
        filename: file.filename,
        lineData: lineData
      };
    });

    calcProportionalTimes(times);

    return times;
  }


  // Calculate proportional times, relative to the longest time in the data
  // set. Modifies data in place.
  function calcProportionalTimes(times) {
    var fileTimes = _.map(times, function(fileData) {
      var lineTimes = _.pluck(fileData.lineData, 'time');
      return _.max(lineTimes);
    });

    var maxTime = _.max(fileTimes);

    _.map(times, function(fileData) {
      _.map(fileData.lineData, function(lineData) {
        lineData.propTime = lineData.time / maxTime;
      });
    });
  }

  // Simplify an array of profile data objects based on the object's ref's
  // filename and line number combinations.
  function simplifyRef(prof, file) {
    // First find the file and line number in the ref, discarding all other
    // ref content.
    var data = _.map(prof, function(item) {
      // Only modify items where the ref includes the file
      if (item.ref === undefined || !_.includes(item.ref.path, file))
        return null;

      var idx = _.lastIndexOf(item.ref.path, file);
      var lineNum = item.ref.line[idx];
      return {
        file: file,
        lineNum: lineNum,
        time: item.time
      };
    });

    // Remove items that didn't include the file
    data = _.reject(data, function(item) {
      return item === null;
    });

    return data;
  }


  function collapseByLineId(prof) {
    var data = _.groupBy(prof, function(row) {
      return row.file + "#" + row.lineNum;
    });

    data = objToArray(data);

    _.map(data, function(group) {
      group.file = group.value[0].file;
      group.lineNum = group.value[0].lineNum;
    });

    return data;
  }


  // Transform column-oriented data (an object with arrays) to row-oriented data
  // (an array of objects).
  function colToRows(x) {
    var colnames = _.keys(x);
    if (colnames.length === 0)
      return {};

    var newdata = [];
    for (var i=0; i < x[colnames[0]].length; i++) {
      var row = {};
      for (var j=0; j < colnames.length; j++) {
        var colname = colnames[j];
        row[colname] = x[colname][i];
      }
      newdata[i] = row;
    }

    return newdata;
  }

  // Given an object of format { a: 1, b: 2 }, return an array of objects with
  // format [ { name: a, value: 1 }, { name: b, value: 2 } ].
  function objToArray(x) {
    x = _.mapValues(x, function(value, key) {
      return {
        name: key,
        value: value
      };
    });

    return _.values(x);
  }

  // Escape an HTML string.
  function escapeHTML(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
   }


  return profvis;
})();
