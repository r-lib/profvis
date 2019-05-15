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
#' @param prof_output Name of an Rprof output file or directory in which to save
#'   profiling data. If \code{NULL} (the default), a temporary file will be used
#'   and automatically removed when the function exits. For a directory, a
#'   random filename is used.
#'
#' @param prof_input The path to an \code{\link{Rprof}} data file.  Not
#'   compatible with \code{expr} or \code{prof_output}.
#' @param width Width of the htmlwidget.
#' @param height Height of the htmlwidget
#' @param split Direction of split. Either \code{"v"} (the default) for
#'   vertical, or \code{"h"} for horizontal. This is the orientation of the
#'   split bar.
#' @param torture Triggers garbage collection after every \code{torture} memory
#'   allocation call.
#'
#'   Note that memory allocation is only approximate due to the nature of the
#'   sampling profiler and garbage collection: when garbage collection triggers,
#'   memory allocations will be attributed to different lines of code. Using
#'   \code{torture = steps} helps prevent this, by making R trigger garbage
#'   collection after every \code{torture} memory allocation step.
#'
#' @seealso \code{\link{print.profvis}} for printing options.
#' @seealso \code{\link{Rprof}} for more information about how the profiling
#'   data is collected.
#'
#' @examples
#' # Only run these examples in interactive R sessions
#' if (interactive()) {
#'
#' # Profile some code
#' profvis({
#'   dat <- data.frame(
#'     x = rnorm(5e4),
#'     y = rnorm(5e4)
#'   )
#'
#'   plot(x ~ y, data = dat)
#'   m <- lm(x ~ y, data = dat)
#'   abline(m, col = "red")
#' })
#'
#'
#' # Save a profile to an HTML file
#' p <- profvis({
#'   dat <- data.frame(
#'     x = rnorm(5e4),
#'     y = rnorm(5e4)
#'   )
#'
#'   plot(x ~ y, data = dat)
#'   m <- lm(x ~ y, data = dat)
#'   abline(m, col = "red")
#' })
#' htmlwidgets::saveWidget(p, "profile.html")
#'
#' # Can open in browser from R
#' browseURL("profile.html")
#'
#' }
#' @import htmlwidgets
#' @importFrom utils Rprof
#' @export
profvis <- function(expr = NULL, interval = 0.01, prof_output = NULL,
                    prof_input = NULL, width = NULL, height = NULL,
                    split = c("h", "v"), torture = 0)
{
  split <- match.arg(split)
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
    # Change the srcfile to add "<expr>" as the filename. Code executed from the
    # console will have "" here, and code executed in a knitr code block will
    # have "<text>". This value is used by the profiler as the filename listed
    # in the profiler output. We need to do this to distinguish code that was
    # run in the profvis({}) code block from code that was run outside of it.
    # See https://github.com/rstudio/profvis/issues/57
    attr(expr_q, "srcfile")$filename <- "<expr>"

    # Keep original expression source code
    expr_source <- attr(expr_q, "wholeSrcref", exact = TRUE)
    expr_source <- attr(expr_source, "srcfile", exact = TRUE)$lines
    # Usually, $lines is a single string, but sometimes it can be split up into a
    # vector. Make sure it's a single string.
    expr_source <- paste(expr_source, collapse = "\n")

    prof_extension <- getOption("profvis.prof_extension", default = ".prof")

    if (is.null(prof_output) && !is.null(getOption("profvis.prof_output")))
      prof_output <- getOption("profvis.prof_output")

    remove_on_exit <- FALSE
    if (is.null(prof_output)) {
      prof_output <- tempfile(fileext = prof_extension)
      remove_on_exit <- TRUE
    }
    else {
      if (dir.exists(prof_output))
        prof_output <- tempfile(fileext = prof_extension, tmpdir = prof_output)
    }

    gc()

    if (!identical(torture, 0)) {
      gctorture2(step = torture)
      on.exit(gctorture2(step = 0), add = TRUE)
    }

    Rprof(prof_output, interval = interval, line.profiling = TRUE,
          gc.profiling = TRUE, memory.profiling = TRUE)
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
  message$prof_output <- prof_output

  # Patterns to highlight on flamegraph
  message$highlight <- highlightPatterns()

  message$split <- split

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
#' @inheritParams profvis
#' @param x The object to print.
#' @param ... Further arguments to passed on to other print methods.
#' @export
print.profvis <- function(x, ..., width = NULL, height = NULL, split = NULL) {

  if (!is.null(split)) {
    split <- match.arg(split, c("h", "v"))
    x$x$message$split <- split
  }
  if (!is.null(width)) x$width <- width
  if (!is.null(height)) x$height <- height

  f <- getOption("profvis.print")
  if (is.function(f)) {
    f(x, ...)
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
