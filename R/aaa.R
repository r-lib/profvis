#' @import rlang
#' @importFrom purrr map map_int map2 transpose simplify
NULL

.onLoad <- function(...) {
  run_on_load()
}

on_load <- function(expr, env = topenv(caller_env())) {
  callback <- function() eval_bare(expr, env)
  env$.__rlang_hook__. <- list2(!!!env$.__rlang_hook__., callback)
}

run_on_load <- function(env = topenv(caller_env())) {
  hook <- env$.__rlang_hook__.
  env_unbind(env, ".__rlang_hook__.")

  for (callback in hook) {
    callback()
  }

  env$.__rlang_hook__. <- NULL
}
