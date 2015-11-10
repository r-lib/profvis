#' Profile an R expression and visualize profiling data
#'
#' This function will run an R expression with profiling, and then return an
#' htmlwidget for interactively exploring the profiling data.
#'
#' An alternate way to use \code{profvis} is to separately capture the profiling
#' data to a file using \code{\link{Rprof}()}, and then pass the path to the
#' corresponding data file as the \code{prof_input} argument to
#' \code{profvis()}.
#'
#' @param expr Code to profile. Not compatible with \code{prof_input}.
#' @param interval Interval for profiling samples, in seconds. Values less than
#'   0.005 (5 ms) will probably not result in accurate timings
#' @param prof_output Name of an Rprof output file in which to save profiling
#'   data. If \code{NULL} (the default), a temporary file will be used and
#'   automatically removed when the function exits.
#' @param prof_input The path to an \code{\link{Rprof}} data file.  Not
#'   compatible with \code{expr} or \code{prof_output}.
#' @param width Width of the htmlwidget.
#' @param height Height of the htmlwidget
#'
#' @seealso \code{\link{print.profvis}} for printing options.
#' @seealso \code{\link{Rprof}} for more information about how the profiling
#'   data is collected.
#'
#' @import htmlwidgets
#' @export
profvis <- function(expr = NULL, interval = 0.01, prof_output = NULL,
                    prof_input = NULL, width = NULL, height = NULL)
{
  expr_q <- substitute(expr)

  if (is.null(prof_input) && is.null(expr_q)) {
    stop("profvis must be called with `expr` or `prof_input` ")
  }
  if (!is.null(prof_input) && (!is.null(expr_q) && !is.null(prof_output))) {
    stop("The `prof_input` argument cannot be used with `expr` or `prof_output`.")
  }
  if (interval < 0.005) {
    message("Intervals smaller than ~5ms will probably not result in accurate timings.")
  }

  if (!is.null(expr_q)) {
    # Keep original expression source code
    expr_source <- attr(expr_q, "wholeSrcref", exact = TRUE)
    expr_source <- attr(expr_source, "srcfile", exact = TRUE)$lines
    # Usually, $lines is a single string, but sometimes it can be split up into a
    # vector. Make sure it's a single string.
    expr_source <- paste(expr_source, collapse = "\n")

    remove_on_exit <- FALSE
    if (is.null(prof_output)) {
      prof_output <- tempfile(fileext = ".prof")
      remove_on_exit <- TRUE
    }

    gc()
    Rprof(prof_output, interval = interval, line.profiling = TRUE,
          gc.profiling = TRUE)
    on.exit(Rprof(NULL), add = TRUE)
    if (remove_on_exit)
      on.exit(unlink(prof_output), add = TRUE)

    tryCatch(
      force(expr),
      error = function(e) {
        message("profvis: code exited with error:\n", e$message, "\n")
      },
      interrupt = function(e) {
        message("profvis: interrupt received.")
      }
    )
    Rprof(NULL)

  } else {
    # If we got here, we were provided a prof_input file instead of expr
    expr_source <- NULL
    prof_output <- prof_input
  }

  message <- parse_rprof(prof_output, expr_source)

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

#' Print a profvis object
#'
#' @param x The object to print.
#' @param viewer If \code{FALSE} (the default), display in an external web
#'   browser. If \code{TRUE}, attempt to display in the RStudio viewer pane.
#'   This can be useful for publishing profvis visualizations.
#' @param ... Further arguments to passed on to other print methods.
#' @export
print.profvis <- function(x, ...,  viewer = FALSE) {
  if (viewer) {
    getS3method("print", "htmlwidget")(x)
  } else {
    NextMethod()
  }
}

#' Widget output function for use in Shiny
#'
#' @param outputId Output variable for profile visualization.
#'
#' @inheritParams profvis
#' @export
profvisOutput <- function(outputId, width = '100%', height = '600px'){
  shinyWidgetOutput(outputId, 'profvis', width, height, package = 'profvis')
}

#' Widget render function for use in Shiny
#'
#' @param expr An expression that returns a profvis object.
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{\link{quote}()})?
#'
#' @export
renderProfvis <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  shinyRenderWidget(expr, profvisOutput, env, quoted = TRUE)
}
