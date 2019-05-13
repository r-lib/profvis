

if (!profvis::is_installed("devtools")) {
  remotes::install_cran("devtools")
}
devtools::spell_check()
devtools::check()
devtools::check_win_oldrelease()
devtools::check_win_release()
devtools::check_win_devel()


if (!profvis::is_installed("rhub")) {
  remotes::install_cran("rhub")
}
rc <- rhub::check_for_cran(show_status = FALSE)
for (i in seq_len(nrow(rc$urls()))) {
  rc$livelog(i)
}
cat("\n\n\n")
rc$cran_summary()


if (!profvis::is_installed("revdepcheck")) {
  remotes::install_github("r-lib/revdepcheck")
}
revdepcheck::revdep_check(num_workers = 4)




devtools::release()
