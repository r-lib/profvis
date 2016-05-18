context("integration")

test_that("description file has compatible fields", {
  # Other projects, like RStudio, depend on multiple version of R being supported.
  # Therefore, worth validating the DESCRIPTION field is backwards compatiable for
  # them to build against older versions of R.

  descriptionFile <- yaml::yaml.load_file(system.file(package = "profvis", "DESCRIPTION"))

  expect_false(identical(descriptionFile[["Author"]], NULL))
  expect_false(identical(descriptionFile[["Maintainer"]], NULL))
})
