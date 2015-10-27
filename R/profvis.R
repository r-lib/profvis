#' Run an R expression and record profiling information
#'
#' @param expr Code to profile.
#' @param interval Interval for profiling samples, in seconds. Values less than
#'   0.005 (5 ms) will probably not result in accurate timings
#' @param prof_file Name of an Rprof output file in which to save profiling
#'   data. If \code{NULL} (the default), a temporary file will be used and
#'   automatically removed when the function exits.
#' @param width Width of the htmlwidget.
#' @param height Height of the htmlwidget
#'
#' @seealso \code{\link{Rprof}} for more information about how the profiling
#'   data is collected.
#'
#' @import htmlwidgets
#' @export
profvis <- function(expr, interval = 0.01, prof_file = NULL, width = NULL, height = NULL) {
  remove_on_exit <- FALSE
  if (is.null(prof_file)) {
    prof_file <- tempfile(fileext = ".prof")
    remove_on_exit <- TRUE
  }

  if (interval < 0.005) {
    message("Intervals smaller than ~5ms will probably not result in accurate timings.")
  }

  # Keep original expression source code
  expr_source <- attr(substitute(expr), "wholeSrcref", exact = TRUE)
  expr_source <- attr(expr_source, "srcfile", exact = TRUE)$lines
  # Usually, $lines is a single string, but sometimes it can be split up into a
  # vector. Make sure it's a single string.
  expr_source <- paste(expr_source, collapse = "\n")


  gc()
  Rprof(prof_file, interval = interval, line.profiling = TRUE,
        gc.profiling = TRUE)
  on.exit(Rprof(NULL), add = TRUE)
  if (remove_on_exit)
    on.exit(unlink(prof_file), add = TRUE)

  tryCatch(
    force(expr),
    error = function(e) {
      message("prof: code exited with error:\n", e$message, "\n")
    },
    interrupt = function(e) {
      message("prof: interrupt received.")
    }
  )
  Rprof(NULL)

  message <- parse_rprof(prof_file, expr_source)

  # Add sequences to collapse
  message$collapseItems <- collapseItems()
  # Patterns to highlight on flamegraph
  message$highlight <- highlightPatterns()


  htmlwidgets::createWidget(
    name = 'profvis',
    list(message = message),
    width = width,
    height = height,
    package = 'profvis',
    sizingPolicy = htmlwidgets::sizingPolicy(
      padding = 0,
      browser.fill = TRUE,
      viewer.suppress = TRUE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = "600px",
      knitr.figure = FALSE
    )
  )
}


#' Widget output function for use in Shiny
#'
#' @export
profvisOutput <- function(outputId, width = '100%', height = '600px'){
  shinyWidgetOutput(outputId, 'profvis', width, height, package = 'profvis')
}

#' Widget render function for use in Shiny
#'
#' @export
renderProfvis <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  shinyRenderWidget(expr, profvisOutput, env, quoted = TRUE)
}
