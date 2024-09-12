# expr and prof_input are mutually exclusive

    Code
      profvis(expr = f(), prof_input = "foo.R")
    Condition
      Error in `profvis()`:
      ! Exactly one of `expr` or `prof_input` must be supplied.

# can capture profile of code with error

    Code
      out <- profvis(f(), rerun = "pause")
    Message
      profvis: code exited with error:
      error
      

