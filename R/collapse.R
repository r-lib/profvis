# Returns a list of call stack labels that can be collapsed
collapseItems <- function() {
  list(
    "withReactiveDomain",
    "try",
    "tryCatch",
    "tryCatchList",
    "tryCatchOne",
    "doTryCatch",
    "shinyCallingHandlers",
    "withCallingHandlers",
    "withVisible",
    "contextFunc",
    ".func",
    "flushCallback",
    "flushReact",
    "func",
    "observerFunc",
    "handler"
  )
}

# A list of regexes to highlight on the flamegraph. The name of each sublist is
# the CSS class to give to cells whose labels match the regex listed. For each
# of these names, there should be a corresponding CSS class in profvis.css.
highlightPatterns <- function() {
  list(
    shaded = list("^output\\$")
  )
}
