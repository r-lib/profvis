test_that("Irrelevant stack is trimmed from profiles (#123)", {
  skip_on_cran()
  
  f <- function() pause(TEST_PAUSE_TIME)

  out <- repro_profvis(f(), simplify = FALSE)
  expect_equal(profvis_modal_value(out$x$message$prof), "pause f")

  out <- profvis(f(), simplify = TRUE, rerun = "pause", interval = 0.005)
  expect_equal(profvis_modal_value(out$x$message$prof), "pause f")

  out <- repro_profvis(f(), simplify = TRUE)
  expect_equal(profvis_modal_value(out$x$message$prof), "pause f")
})
