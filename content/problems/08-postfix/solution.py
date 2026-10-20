import sys
lines = sys.stdin.read().split("\n")
t = int(lines[0])
for line in lines[1:1 + t]:
    st = []
    for tok in line.split():
        if tok in "+-*/^" and len(tok) == 1:
            b = st.pop(); a = st.pop()
            if tok == "+": st.append(a + b)
            elif tok == "-": st.append(a - b)
            elif tok == "*": st.append(a * b)
            elif tok == "^": st.append(a ** b)
            else:
                q = abs(a) // abs(b)
                st.append(q if (a >= 0) == (b >= 0) else -q)
        else:
            st.append(int(tok))
    print(st[0])
