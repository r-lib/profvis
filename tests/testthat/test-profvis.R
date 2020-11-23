
test_that("Irrelevant stack is trimmed from profiles (#123)", {
  f <- function() pause(0.01)

  out <- repro_profvis(f(), simplify = FALSE)
  expect_equal(unique(out$x$message$prof$label), c("pause", "f"))

  out <- profvis(f(), simplify = TRUE, rerun = TRUE, interval = 0.005)
  expect_equal(unique(out$x$message$prof$label), c("pause", "f"))

  out <- repro_profvis(f(), simplify = TRUE)
  expect_equal(unique(out$x$message$prof$label), c("pause", "f"))
})
