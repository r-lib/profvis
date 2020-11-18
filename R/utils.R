# Drop NULLs from a list
drop_nulls <- function(x) {
  x[!vapply(x, is.null, logical(1))]
}


# Everything above this function in the stack will be hidden by default in the
# flamegraph.
..stacktraceoff.. <- function(x) x

is_installed <- function(pkg) {
  found <- TRUE
  tryCatch(utils::packageVersion(pkg),
    error = function(e) found <<- FALSE
  )
  found
}

inject <- function(expr, env = parent.frame()) {
  eval_bare(enexpr(expr), env)
}
