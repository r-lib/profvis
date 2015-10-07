# Returns a list of call stack sequences that can be collapsed
collapseList <- function() {
  list(
    # Reactives
    c("<Anonymous>", "<Anonymous>", "withReactiveDomain", "tryCatch",
      "tryCatchList", "<Anonymous>", "shinyCallingHandlers",
      "withCallingHandlers", "contextFunc", "withVisible", "try", "tryCatch",
      "tryCatchList", "tryCatchOne", "doTryCatch", "shinyCallingHandlers",
      "withCallingHandlers", ".func"),

    # Observers
    c("tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch", "run",
      "<Anonymous>", "withReactiveDomain", "tryCatch", "tryCatchList",
      "<Anonymous>", "shinyCallingHandlers", "withCallingHandlers",
      "contextFunc", "tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch"),

    # Outputs wrapped in observers
     c("tryCatch", "tryCatchList", "tryCatchOne", "doTryCatch",
       "tryCatchList", "tryCatchOne", "doTryCatch", "shinyCallingHandlers",
       "withCallingHandlers")
  )
}
