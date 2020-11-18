#' Generate profiler lines for an expression
#' @param expr,env Expression to evaluate in `env`. The expression is
#'   repeatedly evaluated until `Rprof()` produces an output. Can _be_
#'   an injected quosure but cannot _contain_ injected quosures.
#' @param ... Arguments passed to `Rprof()`.
#' @param trim_stack Whether to trim the current call stack from the
#'   profiles.
rprof_lines <- function(expr, env = caller_env(), ..., trim_stack = TRUE) {
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
    Rprof(prof_file, ...)
    on.exit(Rprof(NULL), add = TRUE)

    do
    Rprof(NULL)

    lines <- readLines(prof_file)[-1]
  }

  if (trim_stack) {
    suffix <- rprof_current_suffix("rprof_lines")
    lines <- gsub(suffix, "", lines, fixed = TRUE)
  }

  lines
}

rprof_current_suffix <- function(sentinel) {
  i <- 0

  repeat {
    if (i > 200) {
      stop("Can't find Rprof prefix.")
    }

    lines <- rprof_lines(pause(0.05), trim_stack = FALSE)

    complete <- which(grepl(sentinel, lines))
    if (length(complete)) {
      complete_line <- lines[[complete[[1]]]]
      break
    }

    i <- i + 1
  }

  pattern <- paste0(" \"", sentinel, "\" ")
  pos <- gregexpr(pattern, complete_line, fixed = TRUE)[[1]]

  if (length(pos) < 1) {
    stop("Unexpected number of parts in `rprof_current_suffix()`.")
  }
  pos <- pos[[length(pos)]]

  substring(complete_line, pos)
}

cat_rprof <- function(expr, ...) {
  out <- inject(rprof_lines({{ expr }}, ...))
  out <- unique(out)
  cat(paste(out, collapse = "\n"))
  cat("\n")
}
inject <- function(expr, env = parent.frame()) {
  eval_bare(enexpr(expr), env)
}

expect_snapshot0 <- function(expr, cran = TRUE) {
  # Prevent `expect_snapshot()` from processing injection operators
  quo <- new_quosure(substitute(expr), parent.frame())
  expect_snapshot(!!quo, cran = cran)
}
