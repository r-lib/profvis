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

modal_value <- function(x) {
  if (!length(x)) {
    return(NULL)
  }

  self_split <- unname(split(x, x))

  lens <- lengths(self_split)
  max_locs <- which(lens == max(lens))

  if (length(max_locs) != 1) {
    return(NULL)
  }

  modal <- self_split[[max_locs]]
  modal[[1]]
}
modal_value0 <- function(x) {
  modal_value(x) %||% abort("Expected modal value.")
}
