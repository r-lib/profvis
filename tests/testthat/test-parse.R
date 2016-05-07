context("parse")

test_that("parsing prof files", {
  # The three lines in this file have three different kinds of call stacks.
  # They start with:
  # "test" 1#1
  # 1#2 "test" 1#1
  # "<GC>" 1#2 "test" 1#1
  p <- parse_rprof("test-parse.prof", expr_source = "line 1\nline 2")

  expect_identical(p$prof$time, c(1L, 2L, 2L, 3L, 3L, 3L))
  expect_identical(p$prof$depth, c(1L, 2L, 1L, 3L, 2L, 1L))
  expect_identical(p$prof$label, c("test", "line 2", "test", "<GC>", "line 2", "test"))
  expect_identical(p$prof$filenum, c(1L, 1L, 1L, NA, 1L, 1L))
  expect_identical(p$prof$linenum, c(1L, 2L, 1L, NA, 2L, 1L))
  # Memory sizes in the test-parse.prof file were chosen to create these values
  expect_identical(p$prof$memalloc, c(136, 152, 152, 168, 168, 168))
  expect_identical(p$prof$meminc, c(0, 16, 0, 16, 0, 0))
  expect_identical(p$prof$filename, c("<expr>", "<expr>", "<expr>", NA, "<expr>", "<expr>"))

  expect_identical(p$interval, 10)
  expect_identical(p$files,
    list(list(filename = "<expr>", content = "line 1\nline 2", normpath = "<expr>"))
  )
})
