test_that("irrelevant stack trimmed from function calls (#123)", {
  skip_on_cran()
  skip_on_covr()

  f <- function() pause(TEST_PAUSE_TIME)
  g <- function() f()

  out <- profvis(g(), simplify = TRUE, rerun = "pause")
  expect_equal(profile_mode(out), "pause f g")

  out <- profvis(g(), simplify = FALSE, rerun = "pause")
  expect_equal(profile_mode(out), "pause f g")
})

test_that("irrelevant stack trimmed from inlined code (#130)", {
  skip_on_cran()
  skip_on_covr()

  out <- profvis(for (i in 1:1e4) rnorm(100), simplify = TRUE, rerun = "rnorm")
  expect_equal(profile_mode(out), "rnorm")

  out <- profvis(for (i in 1:1e4) rnorm(100), simplify = FALSE, rerun = "rnorm")
  expect_equal(profile_mode(out), "rnorm")
})

test_that("strips stack above profvis", {
  skip_on_cran()
  skip_on_covr()

  f <- function() pause(TEST_PAUSE_TIME)
  profvis_wrap <- function(...) profvis(...)

  out <- profvis_wrap(f(), simplify = TRUE, rerun = "pause")
  expect_equal(profile_mode(out), "pause f")

  out <- profvis_wrap(f(), simplify = FALSE, rerun = "pause")
  expect_equal(profile_mode(out), "pause f")
})

test_that("defaults to elapsed timing", {
  skip_on_cran()
  skip_on_covr()
  skip_if_not(has_event())

  f <- function() Sys.sleep(TEST_PAUSE_TIME)

  out <- profvis(f(), rerun = "Sys.sleep")
  expect_equal(profile_mode(out), "Sys.sleep f")
})

test_that("expr and prof_input are mutually exclusive", {
  expect_snapshot(profvis(expr = f(), prof_input = "foo.R"), error = TRUE)
})

test_that("can capture profile of code with error", {
  skip_on_cran()
  skip_on_covr()

  f <- function() {
    pause(TEST_PAUSE_TIME)
    stop("error")
  }
  expect_snapshot(out <- profvis(f(), rerun = "pause"))
  expect_equal(profile_mode(out), "pause f")
})
