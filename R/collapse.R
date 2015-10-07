# Returns a list of call stack sequences that can be collapsed
collapseList <- function() {
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
