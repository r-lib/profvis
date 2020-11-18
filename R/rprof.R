#' Generate profiler lines for an expression
#'
#' @param expr,env Expression to evaluate in `env`. The expression is
#'   repeatedly evaluated until `Rprof()` produces an output. Can _be_
#'   an injected quosure but cannot _contain_ injected quosures.
#' @param ... Arguments passed to `Rprof()`.
#' @param trim_stack Whether to trim the current call stack from the
#'   profiles.
#'
#' @noRd
rprof_lines <- function(expr,
                        env = caller_env(),
                        ...,
                        interval = 0.001,
                        filter.callframes = FALSE,
                        trim_stack = TRUE) {
  expr <- substitute(expr)

  # Support injected quosures
  if (is_quosure(expr)) {
    # Warn if there are any embedded quosures as these are not supported
    quo_squash(expr, warn = TRUE)

    env <- quo_get_env(expr)
    expr <- quo_get_expr(expr)
  }

  lines <- character()

  while (!length(lines)) {
    prof_file <- tempfile("profvis-snapshot", fileext = ".prof")
    on.exit(unlink(prof_file), add = TRUE)

    env_bind_lazy(current_env(), do = !!expr, .eval_env = env)

    gc()
    Rprof(
      prof_file,
      ...,
      interval = interval,
      filter.callframes = filter.callframes
    )
    on.exit(Rprof(NULL), add = TRUE)

    do
    Rprof(NULL)

    lines <- readLines(prof_file)[-1]
  }

  if (trim_stack) {
    if (filter.callframes) {
      call <- call2(rprof_current_suffix_simplified, ...)
      env_bind_lazy(current_env(), do = !!call, .eval_env = env)
      suffix <- do
    } else {
      suffix <- rprof_current_suffix("rprof_lines", ...)
    }
    lines <- gsub(suffix, "", lines)
  }

  lines
}

re_srcref <- "\\d+#\\d+"
re_srcref_opt <- sprintf("( %s | )", re_srcref)

rprof_current_suffix <- function(sentinel = NULL, ...) {
  lines <- rprof_lines(pause(0.05), trim_stack = FALSE, ...)
  line <- unique(zap_meta_data(lines))

  pattern <- sprintf(" \"rprof_current_suffix\"( %s)?", re_srcref)
  pos <- gregexpr(pattern, line)[[1]]

  if (length(pos) != 1 || pos < 0) {
    stop("Unexpected result in `rprof_current_suffix()`.")
  }
  suffix <- substring(line, pos + attr(pos, "match.length"))

  suffix <- srcref_labels_as_wildcards(suffix)
  paste0(suffix, "$")
}

rprof_current_suffix_simplified <- function(..., filter.callframes = NULL) {
  lines <- rprof_lines(pause(0.01), trim_stack = FALSE, ..., filter.callframes = TRUE)
  line <- unique(zap_meta_data(lines))

  pattern <- sprintf("^\"pause\"%s\"<Anonymous>\"%s", re_srcref_opt, re_srcref_opt)
  suffix <- sub(pattern, "", line)

  suffix <- srcref_labels_as_wildcards(suffix)
  paste0(suffix, "$")
}

# File labels of the suffix will differ with those of the actual
# profiles
srcref_labels_as_wildcards <- function(lines) {
  gsub("\\d+#\\d+", "\\\\d+#\\\\d+", lines)
}
