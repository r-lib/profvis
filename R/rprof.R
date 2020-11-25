#' Generate profiler lines for an expression
#'
#' @param expr Expression to profile. The expression is repeatedly
#'   evaluated until `Rprof()` produces an output. Can _be_ a quosure
#'   injected with [rlang::inject()] but cannot _contain_ injected
#'   quosures.
#' @param ... Arguments passed to `Rprof()`.
#' @param trim_stack Whether to trim the current call stack from the
#'   profiles.
#' @param rerun Regexp or `NULL`. If supplied, resamples a new
#'   profile until the regexp matches the modal profile
#'   stack. Metadata is removed from the profiles before matching and
#'   taking the modal value.
#' @noRd
rprof_lines <- function(expr,
                        ...,
                        interval = 0.001,
                        filter.callframes = FALSE,
                        trim_stack = TRUE,
                        rerun = FALSE) {
  c(expr, env) %<-% enquo0_list(expr)

  lines <- character()

  prof_file <- tempfile("profvis-snapshot", fileext = ".prof")
  on.exit(unlink(prof_file), add = TRUE)

  if (has_simplify()) {
    args <- list(filter.callframes = filter.callframes)
  } else {
    args <- NULL
  }
  on.exit(Rprof(NULL), add = TRUE)

  while (!prof_matches(lines, rerun)) {
    env_bind_lazy(current_env(), do = !!expr, .eval_env = env)

    gc()
    inject(Rprof(
      prof_file,
      ...,
      interval = interval,
      !!!args
    ))

    do
    Rprof(NULL)

    lines <- readLines(prof_file, warn = FALSE)[-1]
  }

  if (trim_stack) {
    suffix <- rprof_current_suffix(env, filter.callframes, ...)
    lines <- gsub(suffix, "", lines)
  }

  lines
}

re_srcref <- "\\d+#\\d+"
re_srcref_opt <- sprintf(" (%s )?", re_srcref)

rprof_current_suffix <- function(env, simplify, ...) {
  if (simplify && getRversion() >= "4.0.3") {
    # We need to call the suffix routine from the caller frame. We
    # inline a closure in the call so we can refer to here despite
    # evaluating in a foreign environment. Evaluation is done through
    # a promise to keep the call stack simple.
    call <- call2(function() rprof_current_suffix_linear(...))
    env_bind_lazy(current_env(), do = !!call, .eval_env = env)
    do
  } else {
    rprof_current_suffix_full(...)
  }
}
rprof_current_suffix_full <- function(...) {
  lines <- rprof_lines(
    pause(0.01),
    trim_stack = FALSE,
    ...,
    rerun = "rprof_current_suffix_full"
  )
  line <- modal_value(zap_meta_data(lines))

  pattern <- sprintf(" \"rprof_current_suffix\"( %s)?", re_srcref)
  pos <- gregexpr(pattern, line)[[1]]

  if (length(pos) != 1 || pos < 0) {
    stop("Unexpected state in `rprof_current_suffix()`.")
  }
  suffix <- substring(line, pos + attr(pos, "match.length"))

  suffix <- gsub_srcref_as_wildcards(suffix)
  paste0(suffix, "$")
}

rprof_current_suffix_linear <- function(..., filter.callframes = NULL) {
  lines <- rprof_lines(
    pause(0.01),
    trim_stack = FALSE,
    ...,
    filter.callframes = TRUE,
    rerun = "rprof_current_suffix_linear"
  )
  line <- modal_value(zap_meta_data(lines))

  pattern <- sprintf(
    "^\"pause\"%s\"rprof_current_suffix_linear\"%s\"<Anonymous>\"%s",
    re_srcref_opt,
    re_srcref_opt,
    re_srcref_opt
  )
  suffix <- sub(pattern, "", line)

  suffix <- gsub_srcref_as_wildcards(suffix)
  paste0(suffix, "$")
}

# File labels of the suffix will differ with those of the actual
# profiles
gsub_srcref_as_wildcards <- function(lines) {
  # Strip all existing srcrefs
  lines <- gsub("\\d+#\\d+ ", "", lines)

  # Add wildcards for srcrefs
  lines <- gsub("\" \"", sprintf("\"%s\"", re_srcref_opt), lines, fixed = TRUE)

  lines
}

utils::globalVariables("do")

has_simplify <- function() {
  getRversion() >= "4.0.3"
}
