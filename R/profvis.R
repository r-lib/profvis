#' Profile an R expression and visualize profiling data
#'
#' This function will run an R expression with profiling, and then return an
#' htmlwidget for interactively exploring the profiling data.
#'
#' An alternate way to use `profvis` is to separately capture the profiling
#' data to a file using [Rprof()], and then pass the path to the
#' corresponding data file as the `prof_input` argument to
#' `profvis()`.
#'
#' @param expr Expression to profile. Not compatible with `prof_input`.
#'   The expression is repeatedly evaluated until `Rprof()` produces
#'   an output. It can _be_ a quosure injected with [rlang::inject()] but
#'   it cannot _contain_ injected quosures.
#' @param interval Interval for profiling samples, in seconds. Values less than
#'   0.005 (5 ms) will probably not result in accurate timings
#' @param prof_output Name of an Rprof output file or directory in which to save
#'   profiling data. If `NULL` (the default), a temporary file will be used
#'   and automatically removed when the function exits. For a directory, a
#'   random filename is used.
#'
#' @param prof_input The path to an [Rprof()] data file.  Not
#'   compatible with `expr` or `prof_output`.
#' @param timing The type of timing to use. Either `"elapsed"` (the
#'  default) for wall clock time, or `"cpu"` for CPU time. Wall clock time
#'  includes time spent waiting for other processes (e.g. waiting for a
#'  web page to download) so is generally more useful.
#'
#'  If `NULL`, the default, will use elapsed time where possible, i.e.
#'  on Windows or on R 4.4.0 or greater.
#' @param width Width of the htmlwidget.
#' @param height Height of the htmlwidget
#' @param split Orientation of the split bar: either `"h"` (the default) for
#'   horizontal or `"v"` for vertical.
#' @param torture Triggers garbage collection after every `torture` memory
#'   allocation call.
#'
#'   Note that memory allocation is only approximate due to the nature of the
#'   sampling profiler and garbage collection: when garbage collection triggers,
#'   memory allocations will be attributed to different lines of code. Using
#'   `torture = steps` helps prevent this, by making R trigger garbage
#'   collection after every `torture` memory allocation step.
#' @param simplify Whether to simplify the profiles by removing
#'   intervening frames caused by lazy evaluation. Equivalent to the
#'   `filter.callframes` argument to [Rprof()].
#' @param rerun If `TRUE`, `Rprof()` is run again with `expr` until a
#'   profile is actually produced. This is useful for the cases where
#'   `expr` returns too quickly, before R had time to sample a
#'   profile. Can also be a string containing a regexp to match
#'   profiles. In this case, `profvis()` reruns `expr` until the
#'   regexp matches the modal value of the profile stacks.
#'
#' @seealso [print.profvis()] for printing options.
#' @seealso [Rprof()] for more information about how the profiling
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
profvis <- function(expr = NULL,
                    interval = 0.01,
                    prof_output = NULL,
                    prof_input = NULL,
                    timing = NULL,
                    width = NULL,
                    height = NULL,
                    split = c("h", "v"),
                    torture = 0,
                    simplify = TRUE,
                    rerun = FALSE) {
  split <- match.arg(split)
  c(expr_q, env) %<-% enquo0_list(expr)

  if (is.null(prof_input) && is.null(expr_q)) {
    stop("profvis must be called with `expr` or `prof_input` ")
  }
  if (!is.null(prof_input) && (!is.null(expr_q) && !is.null(prof_output))) {
    stop("The `prof_input` argument cannot be used with `expr` or `prof_output`.")
  }
  if (interval < 0.005) {
    message("Intervals smaller than ~5ms will probably not result in accurate timings.")
  }

  if (is.null(timing)) {
    if (has_event() || Sys.info()[["sysname"]] == "Windows") {
      timing <- "elapsed"
    } else {
      timing <- "cpu"
    }
  } else {
    timing <- arg_match(timing, c("elapsed", "cpu"))
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

    rprof_args <- drop_nulls(list(
      interval = interval,
      line.profiling = TRUE,
      gc.profiling = TRUE,
      memory.profiling = TRUE,
      event = if (has_event()) timing,
      filter.callframes = simplify
    ))

    if (remove_on_exit) {
      on.exit(unlink(prof_output), add = TRUE)
    }
    repeat {
      # Work around https://github.com/r-lib/rlang/issues/1749
      eval(substitute(delayedAssign("expr", expr_q, eval.env = env)))

      inject(Rprof(prof_output, !!!rprof_args))
      cnd <- with_profvis_handlers(expr)
      Rprof(NULL)

      lines <- readLines(prof_output)
      if (!is.null(cnd)) {
        break
      }
      if (prof_matches(zap_header(lines), rerun)) {
        break
      }
    }

    # Must be in the same handler context as `expr` above to get the
    # full stack suffix
    with_profvis_handlers({
      suffix <- rprof_current_suffix(env, simplify)
      lines <- gsub(suffix, "", lines)
    })
  } else {
    # If we got here, we were provided a prof_input file instead of expr
    expr_source <- NULL
    prof_output <- prof_input
    lines <- readLines(prof_output)
  }

  message <- parse_rprof_lines(lines, expr_source)
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

prof_matches <- function(lines, rerun) {
  if (is_bool(rerun)) {
    !rerun || length(lines) > 0
  } else if (is_string(rerun)) {
    mode <- modal_value0(zap_meta_data(lines))
    !is_null(mode) && grepl(rerun, mode)
  } else {
    abort("`rerun` must be logical or a character value.")
  }
}

with_profvis_handlers <- function(expr) {
  tryCatch({
    expr
    NULL
  },
  error = function(cnd) {
    message("profvis: code exited with error:\n", cnd$message, "\n")
    cnd
  },
  interrupt = function(cnd) {
    message("profvis: interrupt received.")
    cnd
  })
}

#' Print a profvis object
#'
#' @inheritParams profvis
#' @param x The object to print.
#' @param ... Further arguments to passed on to other print methods.
#' @param aggregate If `TRUE`, the profiled stacks are aggregated by
#'   name. This makes it easier to see the big picture. Set your own
#'   global default for this argument with `options(profvis.aggregate
#'   = )`.
#' @export
print.profvis <- function(x,
                          ...,
                          width = NULL,
                          height = NULL,
                          split = NULL,
                          aggregate = NULL) {

  if (!is.null(split)) {
    split <- arg_match(split, c("h", "v"))
    x$x$message$split <- split
  }
  if (!is.null(width)) x$width <- width
  if (!is.null(height)) x$height <- height

  aggregate <- aggregate %||% getOption("profvis.aggregate") %||% FALSE
  if (aggregate) {
    x$x$message$prof <- prof_sort(x$x$message$prof)
  }

  f <- getOption("profvis.print")
  if (is.function(f)) {
    f(x, ...)
  } else {
    NextMethod()
  }
}

#' Widget output and renders functions for use in Shiny
#'
#' @param outputId Output variable for profile visualization.
#'
#' @inheritParams profvis
#' @export
profvisOutput <- function(outputId, width = '100%', height = '600px'){
  shinyWidgetOutput(outputId, 'profvis', width, height, package = 'profvis')
}

#' @param expr An expression that returns a profvis object.
#' @param env The environment in which to evaluate `expr`.
#' @param quoted Is `expr` a quoted expression (with [quote()])?
#' @export
#' @rdname profvisOutput
renderProfvis <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  shinyRenderWidget(expr, profvisOutput, env, quoted = TRUE)
}
