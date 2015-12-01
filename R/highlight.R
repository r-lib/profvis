# A list of regexes to highlight on the flamegraph. The name of each sublist is
# the CSS class to give to cells whose labels match the regex listed. For each
# of these names, there should be a corresponding CSS class in profvis.css.
highlightPatterns <- function() {
  list(
    output = list("^output\\$"),
    gc = list("^<GC>$"),
    stacktrace = list("^\\.\\.stacktraceo(n|ff)\\.\\.$")
  )
}
