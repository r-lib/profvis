test_that("split_in_half handles common cases", {
  out <- split_in_half(c("a-b", "a---b", "ab", "", NA), "-+", perl = TRUE)
  expect_equal(out, cbind(
    c("a", "a", "ab", "", NA),
    c("b", "b", "", "", NA)
  ))
})
