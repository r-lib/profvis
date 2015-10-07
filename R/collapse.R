# Returns a list of call stack sequences that can be collapsed
collapseSequences <- function() {
  list(
    Reactive = c("<Anonymous>", "<Anonymous>", "withReactiveDomain", "tryCatch",
      "tryCatchList", "<Anonymous>", "shinyCallingHandlers",
      "withCallingHandlers", "contextFunc", "withVisible", "try", "tryCatch",
      "tryCatchList", "tryCatchOne", "doTryCatch", "shinyCallingHandlers",
      "withCallingHandlers", ".func"),

    Observer = c("tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch", "run",
      "<Anonymous>", "withReactiveDomain", "tryCatch", "tryCatchList",
      "<Anonymous>", "shinyCallingHandlers", "withCallingHandlers",
      "contextFunc", "tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch"),

     OutputObserver = c("tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch",
       "tryCatchList", "tryCatchOne", "doTryCatch", "shinyCallingHandlers",
       "withCallingHandlers")
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
